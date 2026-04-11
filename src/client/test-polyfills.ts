import { TextEncoder, TextDecoder } from 'util';

// react-router v7 uses the Web Encoding API internally.
// jsdom doesn't include it, so we polyfill from Node's util module.
Object.assign(global, { TextEncoder, TextDecoder });
