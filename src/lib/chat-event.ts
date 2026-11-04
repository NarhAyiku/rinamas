/** Opens the "Ask RINAMAS" chat from anywhere (sticky bar, phone menu) without loading the chat code there. */
export const CHAT_EVENT = "rinamas:chat";
export const openChat = () => window.dispatchEvent(new Event(CHAT_EVENT));
