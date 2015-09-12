"""
HMI Class

Data objects coming from subprocess, os and signal modules are used to manage
an http server subprocess that is launched and killed by hmi.py process.
"""

import sys

import matplotlib
matplotlib.use('Agg')  # Agg backend to use matplotlib without X server
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
from matplotlib.figure import Figure
from matplotlib import pyplot as plt

from time import time, sleep

from subprocess import Popen
from os import setsid, kill, killpg, getpgid
from signal import SIGTERM

from multiprocessing import Process

from constants import logger
from constants import P1_PLC1_TAGS, LIT_101, LIT_301, FIT_201
from constants import T_HMI_R, TIMEOUT
from constants import read_cpppo
from constants import L1_PLCS_IP


def set_delta(y_min, y_max, subplot, size):
    """
    Compute y axis limits for a subplot
    """
    if(y_min != y_max):
        delta = size * (y_max - y_min)
        subplot.set_ylim([y_min - delta, y_max + delta])


class HMI(object):
    """
    Class defining the Human-Machine Interface
    An HMI object has to query a list of tags from a PLC ENIP server,
    and log it into a .png file that will be served by a webserver.
    """

    id = 0  # count the number of instances

    def __init__(self, tags, ipaddr, filename, timer, timeout):
        """
        :tags: the ENIP tags to query
        :ipaddr: the IP address of thr PLC to query
        :filename: the name of the .png file
        :timer: period in which the HMI has to query the tags (s)
        :timeout: period of activity (s)
        """
        HMI.id += 1
        self.__id = HMI.id

        self.__tags = tags
        self.__ipaddr = ipaddr
        self.__filename = filename
        self.__timer = timer
        self.__timeout = timeout

        self.__start_time = 0.0
        self.__process = None  # save the HMI PID to kill it later

        # dict of lists
        self.__values = {}  
        # ... one list for each tag
        for tag in tags:
            self.__values[tag] = []
        # ... plus a list to save timestamps
        self.__values['time'] = []

        self.__http = None  # save the HTTP server PID to kill it later

        logger.info('HMI%d - monitors: %s' % (self.__id, ', '.join(map(str, self.__tags))))

    def __del__(self):
        """
        destructor
        """
        # kill the HMI (opened with Process)
        if(self.__process is not None):
            self.__process.join()

        # kill the HTTP server (opened with Popen)
        self.stop_http_server()

        logger.debug('Killed HMI%d and its webserver' % self.__id)

    def start_http_server(self, port=80):
        """
        Starts a simple http server on a choosen port

        :port: integer defaults to 80
        """
        if(self.__http is None):
            cmd = "python -m SimpleHTTPServer %d" % port
            try:
                self.__http = Popen(cmd, shell=True, preexec_fn=setsid)
                logger.info('HMI%d - HTTP server started on port %d' %
                        (self.__id, port))

            except OSError, e:
                emsg = repr(e)
                logger.warning('HMI%d - HTTP server cannot start: %s' %
                        (self.__id, emsg))

    def stop_http_server(self):
        """
        Kills the HTTP server
        """
        if(self.__http is not None):
            killpg(getpgid(self.__http.pid), SIGTERM)
            logger.info('HMI%d - HTTP server stopped' % self.__id)
            self.__http = None

    def mplot(self):
        """
        Callback method, writes the three subplots in the .png file using the
        Matplotlib canvas backend.
        """
        # reference to the eaxis formatter object
        formatter = matplotlib.ticker.ScalarFormatter(useOffset=False)

        # create len(self.__tags) subplots, sharing the x axis
        fig, subplots = plt.subplots(
                nrows=len(self.__tags),
                ncols=1,
                sharex=True,
                sharey=False,
                squeeze=False,
                )

        # with canvans you can update the fig in real-time
        canvas = FigureCanvas(fig)

        for i in range(0, len(subplots)):
            y_min = min(self.__values[self.__tags[i]])
            y_max = max(self.__values[self.__tags[i]])
            if(y_min != 0 and y_max != 1 and y_max != 2):
                set_delta(y_min, y_max, subplots[i], 0.05)
            else:
                subplots[i].set_ylim([-1, 3])
                # labels = [item.get_text() for item in ax.get_xticklabels()]
                # labels[1] = 'Testing'
                # subplots[i].set_xticklabels(labels)

        # set time as a comming x axis
        subplots[len(subplots)-1].set_xlabel('Time')
        subplots[len(subplots)-1].xaxis.set_major_formatter(formatter)
        subplots[len(subplots)-1].set_xticklabels(subplots[len(subplots)-1].xaxis.get_majorticklabels(), rotation=45)

        # set y axis for each subplots
        for i in range(0, len(subplots)):
            subplots[i].set_ylabel(self.__tags[i])
            subplots[i].yaxis.set_major_formatter(formatter)

        subplots[0].set_title('HMI%d' % self.__id)

        for i in range(0, len(subplots)):
            # scatter use points
            subplots[i].scatter(self.__values['time'], self.__values[self.__tags[i]], color='r')

        # save file
        canvas.print_figure('examples/swat/hmi/%s' % self.__filename)

        plt.close(fig)

    def action_wrapper(self):
        """
        Wraps the action() method
        """
        self.__start_time = time()
        while(time() - self.__start_time < self.__timeout):
            try:
                self.action()
                sleep(self.__timer)

            except Exception, e:
                print repr(e)
                sys.exit(1)

    def action(self):
        """
        Defines the action of the HMI:

        - reads the tags using the cpppo helper function and add them to different lists
        - appends the time value to another list
        - calls the mplot function
        """
        for index in self.__tags:
            tag = read_cpppo(self.__ipaddr, index, 'examples/swat/hmi_cpppo.cache')
            logger.debug('HMI%d read %s: %s' % (self.__id, index, tag))
            tag = float(tag)
            self.__values[index].append(tag)

        self.__values['time'].append(time() - self.__start_time)

        self.mplot()

    def start(self):
        """
        Runs the action() method
        """
        self.__process = Process(target=self.action_wrapper)
        self.__process.start()


if __name__ == '__main__':
    """
    The values are displayed in real-time in a pop-up window and the same
    image is served through a webserver that can be reached at
    HMI_IP:80
    """
    hmi = HMI(['HMI_MV101-Status', 'HMI_LIT101-Pv', 'HMI_P101-Status'],
            L1_PLCS_IP['plc1'], 'plc1.png', T_HMI_R, TIMEOUT)
    sleep(3)

    hmi.start()
    hmi.start_http_server(80)
    hmi.stop_http_server()
