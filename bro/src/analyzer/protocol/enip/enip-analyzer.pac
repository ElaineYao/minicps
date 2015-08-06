connection ENIP_Conn(bro_analyzer: BroAnalyzer) {
	upflow   = ENIP_Flow(true);
	downflow = ENIP_Flow(false);
};

%header{
	#define SIZE 8
	#define RESERVED_MASK1 0x1F00
	#define RESERVED_MASK2 0xC000
	#define RESERVED_MASK3 0x00FE
%}

flow ENIP_Flow(is_orig: bool) {
	datagram = ENIP_PDU(is_orig) withcontext(connection, this);
	# flowunit

	function enip_header(cmd: uint16, len: uint16, sh: uint32, st: uint32, sc: bytestring, opt: uint32): bool%{
		if(::enip_header){
			if(cmd == NOP){
				if(st != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message status for NOP (%d)",
											    st));
					return false;
				}
				if(opt != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message options for NOP (%d)",
											opt));
					return false;
				}

				connection()->bro_analyzer()->ProtocolConfirmation();
			}
			else if(cmd == LIST_IDENTITY || cmd == LIST_INTERFACES){
				if(len != 0x0000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message length for LIST_IDENTITY or LIST_INTERFACES (%d)",
											    len));
					return false;
				}
				// if(st != 0x00000000){
				// 	connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message status for LIST_IDENTITY or LIST_INTERFACES (%d)",
				// 							    st));
				// 	return false;
				// }
				for(unsigned int i = 0; i < SIZE; i++){
					if(sc[i] != 0x00){
						connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message sender context for LIST_IDENTITY or LIST_INTERFACES (%d)",
											sc[i]));
					return false;
					}
				}
				if(opt != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message options for LIST_IDENTITY or LIST_INTERFACES (%d)",
											opt));
					return false;
				}

				connection()->bro_analyzer()->ProtocolConfirmation();
			}
			else if(cmd == REGISTER_SESSION){
				if(len != 0x0400){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message length for REGISTER_SESSION (%d)",
											    len));
					return false;
				}
				// if(st != 0x00000000){
				// 	connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message status for REGISTER_SESSION (%d)",
				// 							    st));
				// 	return false;
				// }
				if(opt != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message options for REGISTER_SESSION (%d)",
											opt));
					return false;
				}

				connection()->bro_analyzer()->ProtocolConfirmation();
			}
			else if(cmd == UNREGISTER_SESSION){
				if(len != 0x0000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message length for UNREGISTER_SESSION (%d)",
											    len));
					return false;
				}
				if(st != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message status for UNREGISTER_SESSION (%d)",
											    st));
					return false;
				}
				if(opt != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message options for UNREGISTER_SESSION (%d)",
											opt));
					return false;
				}

				connection()->bro_analyzer()->ProtocolConfirmation();
			}
			else if(cmd == LIST_SERVICES){
				if(is_orig() && len != 0x0000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message length for LIST_SERVICES (%d)",
											    len));
					return false;
				}
				// if(st != 0x00000000){
				// 	connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message status for LIST_SERVICES (%d)",
				// 							    st));
				// 	return false;
				// }
				if(opt != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message options for LIST_SERVICES (%d)",
											opt));
					return false;
				}

				connection()->bro_analyzer()->ProtocolConfirmation();
			}
			else if(cmd == SEND_RR_DATA || cmd == SEND_UNIT_DATA){
				// if(st != 0x00000000){
				// 	connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message status for SEND_RR_DATA or SEND_UNIT_DATA (%d)",
				// 							    st));
				// 	return false;
				// }
				if(opt != 0x00000000){
					connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP message options for SEND_RR_DATA or SEND_UNIT_DATA (%d)",
											opt));
					return false;
				}

				connection()->bro_analyzer()->ProtocolConfirmation();
			}

			VectorVal* sclist = new VectorVal(internal_type("index_vec")->AsVectorType());

			for(unsigned int i = 0; i < SIZE; ++i)
				sclist->Assign(i, new Val(sc[i], TYPE_COUNT));

			BifEvent::generate_enip_header(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), cmd, len, sh, st, sclist, opt);
		}

		return true;
	%}

	function enip_data_address(id: uint16, len: uint16, data: bytestring): bool%{
		if(::enip_data_address){
			if(id != ADDRESS &&
			id != LIST_IDENTITY_RESPONSE &&
			id != CONNECTION_BASED &&
			id != CONNECTED_TRANSPORT_PACKET &&
			id != UNCONNECTED_MESSAGE &&
			id != LIST_SERVICES_RESPONSE &&
			id != SOCKADDR_INFO_O_T &&
			id != SOCKADDR_INFO_T_O &&
			id != SEQUENCED_ADDRESS_ITEM){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP item ID (%d)",
											id));
				return false;
			}

			if(id == ADDRESS && len != 0x0000){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP item ID and length (%d,%d)", id, len));
				return false;
			}
			if(id == CONNECTION_BASED && len != 0x0400){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP item ID and length (%d,%d)", id, len));
				return false;

			}
			if(id == SEQUENCED_ADDRESS_ITEM && len != 0x0800){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP item ID and length (%d,%d)", id, len));
				return false;
			}
			if((id == SOCKADDR_INFO_T_O || id == SOCKADDR_INFO_O_T)
			&& len != 0x1000){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP item ID and length (%d,%d)", id, len));
				return false;
			}

			VectorVal* data_val = new VectorVal(internal_type("index_vec")->AsVectorType());

			for(unsigned int i = 0; i < len; ++i)
				data_val->Assign(i, new Val(data[i], TYPE_COUNT));

			BifEvent::generate_enip_data_address(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), id, len, data_val);
		}

		return true;
	%}

	function enip_common_packet_format(count: uint16): bool%{
		if(::enip_common_packet_format){
			if(count == 0x0100 || count == 0x0000){ //count shall be at least 2
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP item count in Common Packet Format (%d)", count));
				return false;
			}
			BifEvent::generate_enip_common_packet_format(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), count);
		}

		return true;
	%}

	function enip_target_item(type_code: uint16, len: uint16): bool%{
		if(::enip_target_item){
			BifEvent::generate_enip_target_item(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), type_code, len);
		}

		return true;
	%}

	function enip_target_item_services(type_code: uint16, len: uint16, protocol: uint16, flags: uint16): bool%{
		//TODO name: uint8[16]
		//The Name field shall allow up to a 16-byte, NULL-terminated ASCII string for descriptive
		//purposes only. The 16-byte limit shall include the NULL character.
		if(::enip_target_item_services){
			if(protocol != 0x0100){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP protocol in Target Item Services (%d)", protocol));
				return false;
			}
			if(((flags & RESERVED_MASK1) != 0) || ((flags & RESERVED_MASK2) != 0) || ((flags & RESERVED_MASK3) != 0)){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP flags in Target Item Services (%d)", flags));
				return false;
			}
			// VectorVal* name_val = new VectorVal(internal_type("index_vec")->AsVectorType());

			// for(unsigned int i = 0; i < 16; ++i)
			// 	name_val->Assign(i, new Val(name, TYPE_COUNT));

			BifEvent::generate_enip_target_item_services(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), type_code, len, protocol, flags);
		}

		return true;
	%}

	function enip_register(protocol: uint16, options: uint16): bool%{
		if(::enip_register){
			if(protocol != 0x0100){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP protocol in Register (%d)", protocol));
				return false;
			}
			if(options != 0x0000){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP options in Register (%d)", options));
				return false;
			}
			BifEvent::generate_enip_register(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), protocol, options);
		}

		return true;
	%}

	function enip_rr_unit(cmd: uint16, iface_handle: uint32, timeout: uint16): bool%{
		if(::enip_rr_unit){
			if(iface_handle != 0x00000000){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP interface handle in Send_RR or Send_Unit (%d)", iface_handle));
				return false;
			}
			if(cmd == SEND_UNIT_DATA && timeout != 0x0000){
				connection()->bro_analyzer()->ProtocolViolation(fmt("invalid ENIP timeout in Send_Unit (%d)", timeout));
				return false;
			}

			BifEvent::generate_enip_rr_unit(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), iface_handle, timeout);
		}

		return true;
	%}

	function enip_list(item_count: uint16): bool%{
		if(::enip_list){
			BifEvent::generate_enip_list(
				connection()->bro_analyzer(),
				connection()->bro_analyzer()->Conn(),
				is_orig(), item_count);
		}

		return true;
	%}
};

refine typeattr ENIP_Header += &let {
	enip_header: bool = $context.flow.enip_header(cmd, len, sh, st, sc, opt);
};

refine typeattr Data_Address += &let {
	enip_data_address: bool = $context.flow.enip_data_address(id, len, data);
};

refine typeattr Common_Packet_Format += &let {
	enip_common_packet_format: bool = $context.flow.enip_common_packet_format(count);
};

refine typeattr Target_Item += &let {
	enip_target_item: bool = $context.flow.enip_target_item(type_code, len);
};

refine typeattr Target_Item_Services += &let {
	enip_target_item_services: bool = $context.flow.enip_target_item_services(type_code, len, protocol, flags);
};

refine typeattr Register += &let {
	enip_register: bool = $context.flow.enip_register(protocol, options);
};

refine typeattr RR_Unit += &let {
	enip_rr_unit: bool = $context.flow.enip_rr_unit(header.cmd, iface_handle, timeout);
};

refine typeattr List_I += &let {
	enip_list: bool = $context.flow.enip_list(item_count);
};

refine typeattr List_Services += &let {
	enip_list: bool = $context.flow.enip_list(item_count);
};