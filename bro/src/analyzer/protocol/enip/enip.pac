# Generated by binpac_quickstart

# Analyzer for EtherNet/IP Protocol
#  - enip-protocol.pac: describes the enip protocol messages
#  - enip-analyzer.pac: describes the enip analyzer code

%include binpac.pac
%include bro.pac

%extern{
	#include "events.bif.h"
%}

analyzer ENIP withcontext {
	connection: ENIP_Conn;
	flow:       ENIP_Flow;
};

# Our connection consists of two flows, one in each direction.
connection ENIP_Conn(bro_analyzer: BroAnalyzer) {
	upflow   = ENIP_Flow(true);
	downflow = ENIP_Flow(false);
};

%include enip-protocol.pac

# Now we define the flow:
flow ENIP_Flow(is_orig: bool) {

	# ## TODO: Determine if you want flowunit or datagram parsing:

	# Using flowunit will cause the anlayzer to buffer incremental input.
	# This is needed for &oneline and &length. If you don't need this, you'll
	# get better performance with datagram.

	# flowunit = ENIP_PDU(is_orig) withcontext(connection, this);
	datagram = ENIP_PDU(is_orig) withcontext(connection, this);

};

%include enip-analyzer.pac