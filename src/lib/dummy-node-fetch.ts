export default window.fetch ? window.fetch.bind(window) : undefined;
export const Headers = window.Headers;
export const Request = window.Request;
export const Response = window.Response;
