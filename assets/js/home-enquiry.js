/* The homepage's enquiry form lives in a classic inline script, which
   can't import modules; this hands it the shared submit function. */
import { sendEnquiry } from "/assets/js/enquiry.js";
window.fgSendEnquiry = sendEnquiry;
