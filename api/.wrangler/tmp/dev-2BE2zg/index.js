var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = Symbol();

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all: all3 = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all: all3, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder2) => {
  try {
    return decoder2(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder2(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf(`?${key}`, 8);
    if (keyIndex2 === -1) {
      keyIndex2 = url.indexOf(`&${key}`, 8);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class {
  static {
    __name(this, "Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone2 = new Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone2.errorHandler = this.errorHandler;
    clone2.#notFoundHandler = this.#notFoundHandler;
    clone2.routes = this.routes;
    return clone2;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class {
  static {
    __name(this, "Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = class {
  static {
    __name(this, "Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/.pnpm/hono@4.10.0/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/routes/rankings.ts
var rankings = new Hono2();
var P_WINNER = 3;
var P_HOME_GOALS = 2;
var P_AWAY_GOALS = 2;
var P_DIFF = 3;
var sign = /* @__PURE__ */ __name((d) => d === 0 ? 0 : d > 0 ? 1 : -1, "sign");
function scoreUEFA(predHome, predAway, realHome, realAway) {
  if (realHome == null || realAway == null) {
    return { points: 0, exact: 0, diff: 0, winner: 0 };
  }
  if (predHome == null || predAway == null) {
    return { points: 0, exact: 0, diff: 0, winner: 0 };
  }
  const ph = Number(predHome);
  const pa = Number(predAway);
  const rh = Number(realHome);
  const ra = Number(realAway);
  const pd = ph - pa;
  const rd = rh - ra;
  const sameWinner = sign(pd) === sign(rd);
  const correctHome = ph === rh;
  const correctAway = pa === ra;
  const correctDiff = pd === rd;
  const isExact = ph === rh && pa === ra;
  let points = 0;
  if (sameWinner) points += P_WINNER;
  if (correctHome) points += P_HOME_GOALS;
  if (correctAway) points += P_AWAY_GOALS;
  if (correctDiff) points += P_DIFF;
  const exact = isExact ? 1 : 0;
  const diff = !isExact && correctDiff ? 1 : 0;
  const winner = !isExact && !diff && sameWinner ? 1 : 0;
  return { points, exact, diff, winner };
}
__name(scoreUEFA, "scoreUEFA");
var SCORER_BONUS_BY_POS = {
  GR: 10,
  D: 5,
  M: 3,
  A: 1
};
function scorerBonusForPosition(pos) {
  if (!pos) return 0;
  const key = pos.toUpperCase();
  return SCORER_BONUS_BY_POS[key] ?? 0;
}
__name(scorerBonusForPosition, "scorerBonusForPosition");
function cmpRanking(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exact !== a.exact) return b.exact - a.exact;
  if (b.diff !== a.diff) return b.diff - a.diff;
  if (b.winner !== a.winner) return b.winner - a.winner;
  const aa = a.first_pred_at ?? Number.POSITIVE_INFINITY;
  const bb = b.first_pred_at ?? Number.POSITIVE_INFINITY;
  return aa - bb;
}
__name(cmpRanking, "cmpRanking");
rankings.get("/", async (c) => {
  const ym = c.req.query("ym");
  const params = [];
  let where = `f.status = 'FINISHED'`;
  if (ym) {
    where += ` AND strftime('%Y-%m', f.kickoff_at) = ?`;
    params.push(ym);
  }
  const { results: rows } = await c.env.DB.prepare(
    `
      SELECT
        p.user_id,
        p.fixture_id,
        p.home_goals,
        p.away_goals,
        p.scorer_player_id,
        p.created_at,
        f.home_score,
        f.away_score,
        f.kickoff_at
      FROM predictions p
      JOIN fixtures f ON f.id = p.fixture_id
      WHERE ${where}
    `
  ).bind(...params).all();
  const preds = rows ?? [];
  if (!preds.length) {
    return c.json([], 200);
  }
  const { results: scorerRows } = await c.env.DB.prepare(
    `
      SELECT
        fs.fixture_id,
        fs.player_id,
        p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      JOIN fixtures f ON f.id = fs.fixture_id
      WHERE ${where}
    `
  ).bind(...params).all();
  const bonusByFixtureAndPlayer = /* @__PURE__ */ new Map();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition(r.position);
    if (!bonus) continue;
    const key = `${r.fixture_id}:${String(r.player_id)}`;
    bonusByFixtureAndPlayer.set(key, bonus);
  }
  const users = await c.env.DB.prepare(`
      SELECT
        u.id,
        COALESCE(
          NULLIF(TRIM(u.name), ''),
          CASE
            WHEN u.email LIKE '%@%' THEN SUBSTR(u.email, 1, INSTR(u.email,'@')-1)
            ELSE u.email
          END,
          'Jogador'
        ) AS name,
        u.email,
        u.avatar_url
      FROM users u
    `).all();
  const nameById = new Map(users.results?.map((u) => [u.id, u.name]) ?? []);
  const avatarById = new Map(users.results?.map((u) => [u.id, u.avatar_url ?? null]) ?? []);
  const score = {};
  for (const p of preds) {
    const uName = nameById.get(p.user_id) ?? "Jogador";
    if (!score[p.user_id]) {
      score[p.user_id] = {
        user_id: p.user_id,
        name: uName,
        avatar_url: avatarById.get(p.user_id) ?? null,
        points: 0,
        exact: 0,
        diff: 0,
        winner: 0,
        scorer_hits: 0,
        first_pred_at: null
      };
    }
    const acc = score[p.user_id];
    const s = scoreUEFA(p.home_goals, p.away_goals, p.home_score, p.away_score);
    let pts = s.points;
    let hitScorer = false;
    if (p.scorer_player_id != null) {
      const predId = String(p.scorer_player_id);
      const key = `${p.fixture_id}:${predId}`;
      const bonus = bonusByFixtureAndPlayer.get(key) ?? 0;
      if (bonus) {
        pts += bonus;
        hitScorer = true;
      }
    }
    acc.points += pts;
    acc.exact += s.exact;
    acc.diff += s.diff;
    acc.winner += s.winner;
    if (hitScorer) {
      acc.scorer_hits += 1;
    }
    if (p.created_at) {
      const t = new Date(p.created_at).getTime();
      acc.first_pred_at = acc.first_pred_at == null ? t : Math.min(acc.first_pred_at, t);
    }
  }
  const ranking = Object.values(score).sort(cmpRanking);
  return c.json(ranking, 200);
});
rankings.get("/months", async (c) => {
  const { results } = await c.env.DB.prepare(`
      SELECT DISTINCT strftime('%Y-%m', kickoff_at) AS ym
      FROM fixtures
      WHERE status='FINISHED'
      ORDER BY ym DESC
    `).all();
  return c.json((results ?? []).map((r) => r.ym), 200);
});
rankings.get("/games", async (c) => {
  const { results } = await c.env.DB.prepare(`
      SELECT
        f.id,
        f.kickoff_at,
        ht.name AS home_team_name,
        at.name AS away_team_name,
        co.code AS competition_code,
        f.round_label
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      ORDER BY f.kickoff_at DESC
      LIMIT 300
    `).all();
  return c.json(results ?? [], 200);
});
rankings.get("/game", async (c) => {
  const fixtureId = c.req.query("fixtureId");
  if (!fixtureId) return c.json({ error: "missing_fixtureId" }, 400);
  const fx = await c.env.DB.prepare(`
      SELECT id, status, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `).bind(fixtureId).first();
  if (!fx) return c.json({ error: "fixture_not_found" }, 404);
  const { results: scorerRows } = await c.env.DB.prepare(
    `
      SELECT 
        fs.player_id,
        p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
    `
  ).bind(fixtureId).all();
  const scorerBonusByPlayer = /* @__PURE__ */ new Map();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition(r.position);
    if (!bonus) continue;
    scorerBonusByPlayer.set(String(r.player_id), bonus);
  }
  const { results } = await c.env.DB.prepare(`
      SELECT
        u.id                              AS user_id,
        COALESCE(
          NULLIF(TRIM(u.name), ''),
          CASE
            WHEN u.email LIKE '%@%' THEN SUBSTR(u.email, 1, INSTR(u.email,'@')-1)
            ELSE u.email
          END,
          'Jogador'
        )                                  AS name,
        u.avatar_url                       AS avatar_url,
        p.home_goals                       AS pred_home,
        p.away_goals                       AS pred_away,
        p.scorer_player_id                 AS pred_scorer_id,
        p.created_at                       AS pred_created_at
      FROM users u
      LEFT JOIN predictions p
        ON p.user_id = u.id AND p.fixture_id = ?
      ORDER BY name COLLATE NOCASE ASC
    `).bind(fixtureId).all();
  const rows = (results ?? []).map((r) => {
    const s = scoreUEFA(r.pred_home, r.pred_away, fx.home_score, fx.away_score);
    let pts = s.points;
    let hitScorer = false;
    if (r.pred_scorer_id != null) {
      const id = String(r.pred_scorer_id);
      const bonus = scorerBonusByPlayer.get(id) ?? 0;
      if (bonus) {
        pts += bonus;
        hitScorer = true;
      }
    }
    const first_pred_at = r.pred_created_at ? new Date(r.pred_created_at).getTime() : null;
    return {
      user_id: r.user_id,
      name: r.name ?? "Jogador",
      avatar_url: r.avatar_url,
      points: pts,
      exact: s.exact,
      diff: s.diff,
      winner: s.winner,
      scorer_hits: hitScorer ? 1 : 0,
      // 0 ou 1 neste jogo
      first_pred_at
      // para desempate final
    };
  });
  rows.sort(cmpRanking);
  return c.json(rows, 200);
});

// src/routes/admin/competitions.ts
var adminCompetitions = new Hono2();
adminCompetitions.get("/", async (c) => {
  const key = c.req.header("x-admin-key");
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: "forbidden" }, 403);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, name FROM competitions ORDER BY name`
  ).all();
  return c.json(results ?? []);
});

// src/routes/admin.ts
var SCORER_BONUS_BY_POS2 = {
  GR: 10,
  D: 5,
  M: 3,
  A: 1
};
function scorerBonusForPosition2(pos) {
  if (!pos) return 0;
  const key = pos.toUpperCase();
  return SCORER_BONUS_BY_POS2[key] ?? 0;
}
__name(scorerBonusForPosition2, "scorerBonusForPosition");
async function recomputePointsForFixture(DB, fixtureId) {
  const db = DB;
  const fx = await db.prepare(
    `
      SELECT id, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `
  ).bind(fixtureId).first();
  if (!fx || fx.home_score == null || fx.away_score == null) {
    await db.prepare(
      `
        UPDATE predictions
        SET points = NULL
        WHERE fixture_id = ?
      `
    ).bind(fixtureId).run();
    return;
  }
  const { home_score, away_score } = fx;
  const { results: scorerRows } = await db.prepare(
    `
      SELECT fs.player_id, p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
    `
  ).bind(fixtureId).all();
  const bonusByPlayer = /* @__PURE__ */ new Map();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition2(r.position);
    if (bonus) {
      bonusByPlayer.set(String(r.player_id), bonus);
    }
  }
  const { results: preds } = await db.prepare(
    `
      SELECT
        id,
        user_id,
        fixture_id,
        home_goals,
        away_goals,
        scorer_player_id
      FROM predictions
      WHERE fixture_id = ?
    `
  ).bind(fixtureId).all();
  for (const p of preds ?? []) {
    const s = scoreUEFA(
      p.home_goals,
      p.away_goals,
      home_score,
      away_score
    );
    let pts = s.points;
    if (p.scorer_player_id != null) {
      const key = String(p.scorer_player_id);
      const bonus = bonusByPlayer.get(key) ?? 0;
      pts += bonus;
    }
    await db.prepare(
      `
        UPDATE predictions
        SET points = ?
        WHERE id = ?
      `
    ).bind(pts, p.id).run();
  }
}
__name(recomputePointsForFixture, "recomputePointsForFixture");
var requireAdminKey = /* @__PURE__ */ __name(async (c, next) => {
  const key = c.req.header("x-admin-key")?.trim() || "";
  const origin = c.req.header("origin") || "";
  const trustedOrigin = origin.startsWith("https://maispredictor.app") || origin.startsWith("http://localhost:3000");
  if (!trustedOrigin && (!key || key !== c.env.ADMIN_KEY)) {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
}, "requireAdminKey");
var admin = new Hono2();
admin.get("/health", (c) => c.json({ ok: true }));
admin.get("/role", requireAdminKey, async (c) => {
  const email = c.req.query("email");
  if (!email) return c.json({ error: "email required" }, 400);
  const row = await c.env.DB.prepare("SELECT role FROM users WHERE email = ?").bind(email).first();
  return c.json({ role: row?.role ?? "user" });
});
admin.get("/teams", requireAdminKey, async (c) => {
  const { results } = await c.env.DB.prepare(`
      SELECT id, name, short_name, crest_url
      FROM teams
      ORDER BY name
    `).all();
  return c.json(results);
});
admin.get("/competitions", requireAdminKey, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, code, name FROM competitions ORDER BY name").all();
  return c.json(results);
});
admin.get("/fixtures/porto", requireAdminKey, async (c) => {
  const token = (c.env.FOOTBALL_DATA_TOKEN || "").trim();
  if (!token) return c.json({ error: "missing token" }, 500);
  const url = "https://api.football-data.org/v4/teams/503/matches?status=SCHEDULED";
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Auth-Token": token,
      accept: "application/json"
    },
    redirect: "manual"
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const status = res.status === 204 || res.status === 205 || res.status === 304 ? 500 : res.status;
    return c.json(
      { error: "upstream", status: res.status, body },
      status
    );
  }
  const data = await res.json();
  return c.json(data);
});

// src/routes/admin/players.ts
var adminPlayers = new Hono2();
adminPlayers.use("*", requireAdminKey);
adminPlayers.get("/", async (c) => {
  const teamId = c.req.query("team_id") ?? "fcp";
  const stmt = c.env.DB.prepare(
    `
    SELECT id, team_id, name, position
    FROM players
    WHERE team_id = ?
    ORDER BY
      CASE position
        WHEN 'GR' THEN 1
        WHEN 'D'  THEN 2
        WHEN 'M'  THEN 3
        WHEN 'A'  THEN 4
        ELSE 5
      END,
      name
  `
  );
  const rs = await stmt.bind(teamId).all();
  return c.json(rs.results ?? []);
});

// src/routes/admin/fixture-scorers.ts
var adminFixtureScorers = new Hono2();
adminFixtureScorers.use("*", requireAdminKey);
adminFixtureScorers.get("/:id/scorers", async (c) => {
  const fixtureId = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `
      SELECT fs.player_id, p.name, p.position
      FROM fixture_scorers fs
      JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
      ORDER BY p.name
    `
  ).bind(fixtureId).all();
  return c.json(results ?? []);
});
adminFixtureScorers.put("/:id/scorers", async (c) => {
  const fixtureId = c.req.param("id");
  const body = await c.req.json().catch(() => ({
    player_ids: []
  }));
  const rawIds = body.player_ids ?? [];
  const ids = rawIds.map((x) => String(x).trim()).filter((x) => x.length > 0);
  const db = c.env.DB;
  await db.prepare(`DELETE FROM fixture_scorers WHERE fixture_id = ?`).bind(fixtureId).run();
  for (const pid of ids) {
    await db.prepare(
      `
        INSERT INTO fixture_scorers (fixture_id, player_id, created_at)
        VALUES (?, ?, datetime('now'))
      `
    ).bind(fixtureId, pid).run();
  }
  await recomputePointsForFixture(db, fixtureId);
  return c.json({ ok: true, fixture_id: fixtureId, player_ids: ids });
});

// src/routes/admin/teams.ts
var adminTeams = new Hono2();
function requireAdmin(c) {
  const need = c.env.ADMIN_KEY;
  if (!need) return void 0;
  const got = c.req.header("x-admin-key");
  if (!got || got !== need) {
    return c.json({ error: "forbidden" }, 403);
  }
  return void 0;
}
__name(requireAdmin, "requireAdmin");
var run = /* @__PURE__ */ __name((db, sql, ...args) => db.prepare(sql).bind(...args).run(), "run");
var all = /* @__PURE__ */ __name((db, sql, ...args) => db.prepare(sql).bind(...args).all(), "all");
adminTeams.get("/", async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const { results } = await all(
    c.env.DB,
    `
    SELECT
      id,
      name,
      short_name,
      crest_url
    FROM teams
    ORDER BY name
    `
  );
  return c.json(results ?? []);
});
adminTeams.post("/", async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.name) {
    return c.json({ error: "missing_id_or_name" }, 400);
  }
  await run(
    c.env.DB,
    `
    INSERT INTO teams (id, name, short_name, crest_url)
    VALUES (?, ?, ?, ?)
    `,
    body.id.trim(),
    body.name.trim(),
    body.short_name?.trim() || null,
    body.crest_url?.trim() || null
  );
  return c.json({ ok: true });
});
adminTeams.patch("/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!id) return c.json({ error: "missing_id" }, 400);
  if (!body) return c.json({ error: "invalid_json" }, 400);
  await run(
    c.env.DB,
    `
    UPDATE teams
    SET
      name       = COALESCE(?, name),
      short_name = COALESCE(?, short_name),
      crest_url  = COALESCE(?, crest_url)
    WHERE id = ?
    `,
    body.name ?? null,
    body.short_name ?? null,
    body.crest_url ?? null,
    id
  );
  return c.json({ ok: true });
});
adminTeams.delete("/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing_id" }, 400);
  await run(
    c.env.DB,
    `
    DELETE FROM fixtures
    WHERE home_team_id = ? OR away_team_id = ?
    `,
    id,
    id
  );
  await run(c.env.DB, `DELETE FROM teams WHERE id = ?`, id);
  return c.json({ ok: true });
});

// src/cors.ts
var corsMiddleware = /* @__PURE__ */ __name(async (c, next) => {
  const origin = c.req.header("Origin") ?? "*";
  const reqHeaders = c.req.header("Access-Control-Request-Headers") ?? "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Vary", "Origin");
  c.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  c.header("Access-Control-Allow-Headers", reqHeaders);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Max-Age", "86400");
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
}, "corsMiddleware");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/webcrypto.js
var webcrypto_default = crypto;
var isCryptoKey = /* @__PURE__ */ __name((key) => key instanceof CryptoKey, "isCryptoKey");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/base64url.js
var decodeBase64 = /* @__PURE__ */ __name((encoded) => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}, "decodeBase64");
var decode = /* @__PURE__ */ __name((input) => {
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}, "decode");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/util/errors.js
var JOSEError = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  constructor(message2, options) {
    super(message2, options);
    this.code = "ERR_JOSE_GENERIC";
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
JOSEError.code = "ERR_JOSE_GENERIC";
var JWTClaimValidationFailed = class extends JOSEError {
  static {
    __name(this, "JWTClaimValidationFailed");
  }
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
JWTClaimValidationFailed.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
var JWTExpired = class extends JOSEError {
  static {
    __name(this, "JWTExpired");
  }
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.code = "ERR_JWT_EXPIRED";
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
JWTExpired.code = "ERR_JWT_EXPIRED";
var JOSEAlgNotAllowed = class extends JOSEError {
  static {
    __name(this, "JOSEAlgNotAllowed");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
  }
};
JOSEAlgNotAllowed.code = "ERR_JOSE_ALG_NOT_ALLOWED";
var JOSENotSupported = class extends JOSEError {
  static {
    __name(this, "JOSENotSupported");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JOSE_NOT_SUPPORTED";
  }
};
JOSENotSupported.code = "ERR_JOSE_NOT_SUPPORTED";
var JWEDecryptionFailed = class extends JOSEError {
  static {
    __name(this, "JWEDecryptionFailed");
  }
  constructor(message2 = "decryption operation failed", options) {
    super(message2, options);
    this.code = "ERR_JWE_DECRYPTION_FAILED";
  }
};
JWEDecryptionFailed.code = "ERR_JWE_DECRYPTION_FAILED";
var JWEInvalid = class extends JOSEError {
  static {
    __name(this, "JWEInvalid");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JWE_INVALID";
  }
};
JWEInvalid.code = "ERR_JWE_INVALID";
var JWSInvalid = class extends JOSEError {
  static {
    __name(this, "JWSInvalid");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JWS_INVALID";
  }
};
JWSInvalid.code = "ERR_JWS_INVALID";
var JWTInvalid = class extends JOSEError {
  static {
    __name(this, "JWTInvalid");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JWT_INVALID";
  }
};
JWTInvalid.code = "ERR_JWT_INVALID";
var JWKInvalid = class extends JOSEError {
  static {
    __name(this, "JWKInvalid");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JWK_INVALID";
  }
};
JWKInvalid.code = "ERR_JWK_INVALID";
var JWKSInvalid = class extends JOSEError {
  static {
    __name(this, "JWKSInvalid");
  }
  constructor() {
    super(...arguments);
    this.code = "ERR_JWKS_INVALID";
  }
};
JWKSInvalid.code = "ERR_JWKS_INVALID";
var JWKSNoMatchingKey = class extends JOSEError {
  static {
    __name(this, "JWKSNoMatchingKey");
  }
  constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
    super(message2, options);
    this.code = "ERR_JWKS_NO_MATCHING_KEY";
  }
};
JWKSNoMatchingKey.code = "ERR_JWKS_NO_MATCHING_KEY";
var JWKSMultipleMatchingKeys = class extends JOSEError {
  static {
    __name(this, "JWKSMultipleMatchingKeys");
  }
  constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message2, options);
    this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  }
};
JWKSMultipleMatchingKeys.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
var JWKSTimeout = class extends JOSEError {
  static {
    __name(this, "JWKSTimeout");
  }
  constructor(message2 = "request timed out", options) {
    super(message2, options);
    this.code = "ERR_JWKS_TIMEOUT";
  }
};
JWKSTimeout.code = "ERR_JWKS_TIMEOUT";
var JWSSignatureVerificationFailed = class extends JOSEError {
  static {
    __name(this, "JWSSignatureVerificationFailed");
  }
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
    this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
};
JWSSignatureVerificationFailed.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/crypto_key.js
function unusable(name, prop = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
__name(unusable, "unusable");
function isAlgorithm(algorithm, name) {
  return algorithm.name === name;
}
__name(isAlgorithm, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usages) {
  if (usages.length && !usages.some((expected) => key.usages.includes(expected))) {
    let msg = "CryptoKey does not support this operation, its usages must include ";
    if (usages.length > 2) {
      const last = usages.pop();
      msg += `one of ${usages.join(", ")}, or ${last}.`;
    } else if (usages.length === 2) {
      msg += `one of ${usages[0]} or ${usages[1]}.`;
    } else {
      msg += `${usages[0]}.`;
    }
    throw new TypeError(msg);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, ...usages) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (key.algorithm.name !== "Ed25519" && key.algorithm.name !== "Ed448") {
        throw unusable("Ed25519 or Ed448");
      }
      break;
    }
    case "Ed25519": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usages);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/invalid_key_input.js
function message(msg, actual, ...types2) {
  types2 = types2.filter(Boolean);
  if (types2.length > 2) {
    const last = types2.pop();
    msg += `one of type ${types2.join(", ")}, or ${last}.`;
  } else if (types2.length === 2) {
    msg += `one of type ${types2[0]} or ${types2[1]}.`;
  } else {
    msg += `of type ${types2[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalid_key_input_default = /* @__PURE__ */ __name((actual, ...types2) => {
  return message("Key must be ", actual, ...types2);
}, "default");
function withAlg(alg, actual, ...types2) {
  return message(`Key for the ${alg} algorithm must be `, actual, ...types2);
}
__name(withAlg, "withAlg");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/is_key_like.js
var is_key_like_default = /* @__PURE__ */ __name((key) => {
  if (isCryptoKey(key)) {
    return true;
  }
  return key?.[Symbol.toStringTag] === "KeyObject";
}, "default");
var types = ["CryptoKey"];

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/is_disjoint.js
var isDisjoint = /* @__PURE__ */ __name((...headers) => {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}, "isDisjoint");
var is_disjoint_default = isDisjoint;

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/is_object.js
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
__name(isObjectLike, "isObjectLike");
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject, "isObject");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/check_key_length.js
var check_key_length_default = /* @__PURE__ */ __name((alg, key) => {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}, "default");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/is_jwk.js
function isJWK(key) {
  return isObject(key) && typeof key.kty === "string";
}
__name(isJWK, "isJWK");
function isPrivateJWK(key) {
  return key.kty !== "oct" && typeof key.d === "string";
}
__name(isPrivateJWK, "isPrivateJWK");
function isPublicJWK(key) {
  return key.kty !== "oct" && typeof key.d === "undefined";
}
__name(isPublicJWK, "isPublicJWK");
function isSecretJWK(key) {
  return isJWK(key) && key.kty === "oct" && typeof key.k === "string";
}
__name(isSecretJWK, "isSecretJWK");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/jwk_to_key.js
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "EdDSA":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
var parse = /* @__PURE__ */ __name(async (jwk) => {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const rest = [
    algorithm,
    jwk.ext ?? false,
    jwk.key_ops ?? keyUsages
  ];
  const keyData = { ...jwk };
  delete keyData.alg;
  delete keyData.use;
  return webcrypto_default.subtle.importKey("jwk", keyData, ...rest);
}, "parse");
var jwk_to_key_default = parse;

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/normalize_key.js
var exportKeyValue = /* @__PURE__ */ __name((k) => decode(k), "exportKeyValue");
var privCache;
var pubCache;
var isKeyObject = /* @__PURE__ */ __name((key) => {
  return key?.[Symbol.toStringTag] === "KeyObject";
}, "isKeyObject");
var importAndCache = /* @__PURE__ */ __name(async (cache, key, jwk, alg, freeze = false) => {
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwk_to_key_default({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "importAndCache");
var normalizePublicKey = /* @__PURE__ */ __name((key, alg) => {
  if (isKeyObject(key)) {
    let jwk = key.export({ format: "jwk" });
    delete jwk.d;
    delete jwk.dp;
    delete jwk.dq;
    delete jwk.p;
    delete jwk.q;
    delete jwk.qi;
    if (jwk.k) {
      return exportKeyValue(jwk.k);
    }
    pubCache || (pubCache = /* @__PURE__ */ new WeakMap());
    return importAndCache(pubCache, key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k)
      return decode(key.k);
    pubCache || (pubCache = /* @__PURE__ */ new WeakMap());
    const cryptoKey = importAndCache(pubCache, key, key, alg, true);
    return cryptoKey;
  }
  return key;
}, "normalizePublicKey");
var normalizePrivateKey = /* @__PURE__ */ __name((key, alg) => {
  if (isKeyObject(key)) {
    let jwk = key.export({ format: "jwk" });
    if (jwk.k) {
      return exportKeyValue(jwk.k);
    }
    privCache || (privCache = /* @__PURE__ */ new WeakMap());
    return importAndCache(privCache, key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k)
      return decode(key.k);
    privCache || (privCache = /* @__PURE__ */ new WeakMap());
    const cryptoKey = importAndCache(privCache, key, key, alg, true);
    return cryptoKey;
  }
  return key;
}, "normalizePrivateKey");
var normalize_key_default = { normalizePublicKey, normalizePrivateKey };

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/key/import.js
async function importJWK(jwk, alg) {
  if (!isObject(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  alg || (alg = jwk.alg);
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
    case "EC":
    case "OKP":
      return jwk_to_key_default({ ...jwk, alg });
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(importJWK, "importJWK");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0 && key.use !== "sig") {
    throw new TypeError("Invalid key for this operation, when present its use must be sig");
  }
  if (key.key_ops !== void 0 && key.key_ops.includes?.(usage) !== true) {
    throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${usage}`);
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, when present its alg must be ${alg}`);
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
  if (key instanceof Uint8Array)
    return;
  if (allowJwk && isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types, "Uint8Array", allowJwk ? "JSON Web Key" : null));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
  if (allowJwk && isJWK(key)) {
    switch (usage) {
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a private JWK`);
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a public JWK`);
    }
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types, allowJwk ? "JSON Web Key" : null));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (usage === "sign" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
  }
  if (usage === "decrypt" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
  }
  if (key.algorithm && usage === "verify" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
  }
  if (key.algorithm && usage === "encrypt" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
  }
}, "asymmetricTypeCheck");
function checkKeyType(allowJwk, alg, key, usage) {
  const symmetric = alg.startsWith("HS") || alg === "dir" || alg.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(alg);
  if (symmetric) {
    symmetricTypeCheck(alg, key, usage, allowJwk);
  } else {
    asymmetricTypeCheck(alg, key, usage, allowJwk);
  }
}
__name(checkKeyType, "checkKeyType");
var check_key_type_default = checkKeyType.bind(void 0, false);
var checkKeyTypeWithJwk = checkKeyType.bind(void 0, true);

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit, "validateCrit");
var validate_crit_default = validateCrit;

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/validate_algorithms.js
var validateAlgorithms = /* @__PURE__ */ __name((option, algorithms) => {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}, "validateAlgorithms");
var validate_algorithms_default = validateAlgorithms;

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/subtle_dsa.js
function subtleDsa(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: alg.slice(-3) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
      return { name: "Ed25519" };
    case "EdDSA":
      return { name: algorithm.name };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleDsa, "subtleDsa");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/get_sign_verify_key.js
async function getCryptoKey(alg, key, usage) {
  if (usage === "sign") {
    key = await normalize_key_default.normalizePrivateKey(key, alg);
  }
  if (usage === "verify") {
    key = await normalize_key_default.normalizePublicKey(key, alg);
  }
  if (isCryptoKey(key)) {
    checkSigCryptoKey(key, alg, usage);
    return key;
  }
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalid_key_input_default(key, ...types));
    }
    return webcrypto_default.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  throw new TypeError(invalid_key_input_default(key, ...types, "Uint8Array", "JSON Web Key"));
}
__name(getCryptoKey, "getCryptoKey");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/verify.js
var verify = /* @__PURE__ */ __name(async (alg, key, signature, data) => {
  const cryptoKey = await getCryptoKey(alg, key, "verify");
  check_key_length_default(alg, cryptoKey);
  const algorithm = subtleDsa(alg, cryptoKey.algorithm);
  try {
    return await webcrypto_default.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}, "verify");
var verify_default = verify;

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!is_disjoint_default(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validate_algorithms_default("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
    checkKeyTypeWithJwk(alg, key, "verify");
    if (isJWK(key)) {
      key = await importJWK(key, alg);
    }
  } else {
    checkKeyTypeWithJwk(alg, key, "verify");
  }
  const data = concat(encoder.encode(jws.protected ?? ""), encoder.encode("."), typeof jws.payload === "string" ? encoder.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode(jws.signature);
  } catch {
    throw new JWSInvalid("Failed to base64url decode the signature");
  }
  const verified = await verify_default(alg, key, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode(jws.payload);
    } catch {
      throw new JWSInvalid("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/epoch.js
var epoch_default = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "default");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/secs.js
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var secs_default = /* @__PURE__ */ __name((str) => {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}, "default");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/lib/jwt_claims_set.js
var normalizeTyp = /* @__PURE__ */ __name((value) => value.toLowerCase().replace(/^application\//, ""), "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
var jwt_claims_set_default = /* @__PURE__ */ __name((protectedHeader, encodedPayload, options = {}) => {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs_default(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch_default(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs_default(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}, "default");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = jwt_claims_set_default(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/jwks/local.js
function getKtyFromAlg(alg) {
  switch (typeof alg === "string" && alg.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    default:
      throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
  }
}
__name(getKtyFromAlg, "getKtyFromAlg");
function isJWKSLike(jwks) {
  return jwks && typeof jwks === "object" && Array.isArray(jwks.keys) && jwks.keys.every(isJWKLike);
}
__name(isJWKSLike, "isJWKSLike");
function isJWKLike(key) {
  return isObject(key);
}
__name(isJWKLike, "isJWKLike");
function clone(obj) {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}
__name(clone, "clone");
var LocalJWKSet = class {
  static {
    __name(this, "LocalJWKSet");
  }
  constructor(jwks) {
    this._cached = /* @__PURE__ */ new WeakMap();
    if (!isJWKSLike(jwks)) {
      throw new JWKSInvalid("JSON Web Key Set malformed");
    }
    this._jwks = clone(jwks);
  }
  async getKey(protectedHeader, token) {
    const { alg, kid } = { ...protectedHeader, ...token?.header };
    const kty = getKtyFromAlg(alg);
    const candidates = this._jwks.keys.filter((jwk2) => {
      let candidate = kty === jwk2.kty;
      if (candidate && typeof kid === "string") {
        candidate = kid === jwk2.kid;
      }
      if (candidate && typeof jwk2.alg === "string") {
        candidate = alg === jwk2.alg;
      }
      if (candidate && typeof jwk2.use === "string") {
        candidate = jwk2.use === "sig";
      }
      if (candidate && Array.isArray(jwk2.key_ops)) {
        candidate = jwk2.key_ops.includes("verify");
      }
      if (candidate) {
        switch (alg) {
          case "ES256":
            candidate = jwk2.crv === "P-256";
            break;
          case "ES256K":
            candidate = jwk2.crv === "secp256k1";
            break;
          case "ES384":
            candidate = jwk2.crv === "P-384";
            break;
          case "ES512":
            candidate = jwk2.crv === "P-521";
            break;
          case "Ed25519":
            candidate = jwk2.crv === "Ed25519";
            break;
          case "EdDSA":
            candidate = jwk2.crv === "Ed25519" || jwk2.crv === "Ed448";
            break;
        }
      }
      return candidate;
    });
    const { 0: jwk, length } = candidates;
    if (length === 0) {
      throw new JWKSNoMatchingKey();
    }
    if (length !== 1) {
      const error = new JWKSMultipleMatchingKeys();
      const { _cached } = this;
      error[Symbol.asyncIterator] = async function* () {
        for (const jwk2 of candidates) {
          try {
            yield await importWithAlgCache(_cached, jwk2, alg);
          } catch {
          }
        }
      };
      throw error;
    }
    return importWithAlgCache(this._cached, jwk, alg);
  }
};
async function importWithAlgCache(cache, jwk, alg) {
  const cached = cache.get(jwk) || cache.set(jwk, {}).get(jwk);
  if (cached[alg] === void 0) {
    const key = await importJWK({ ...jwk, ext: true }, alg);
    if (key instanceof Uint8Array || key.type !== "public") {
      throw new JWKSInvalid("JSON Web Key Set members must be public keys");
    }
    cached[alg] = key;
  }
  return cached[alg];
}
__name(importWithAlgCache, "importWithAlgCache");
function createLocalJWKSet(jwks) {
  const set = new LocalJWKSet(jwks);
  const localJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "localJWKSet");
  Object.defineProperties(localJWKSet, {
    jwks: {
      value: /* @__PURE__ */ __name(() => clone(set._jwks), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return localJWKSet;
}
__name(createLocalJWKSet, "createLocalJWKSet");

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/runtime/fetch_jwks.js
var fetchJwks = /* @__PURE__ */ __name(async (url, timeout, options) => {
  let controller;
  let id;
  let timedOut = false;
  if (typeof AbortController === "function") {
    controller = new AbortController();
    id = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
  }
  const response = await fetch(url.href, {
    signal: controller ? controller.signal : void 0,
    redirect: "manual",
    headers: options.headers
  }).catch((err) => {
    if (timedOut)
      throw new JWKSTimeout();
    throw err;
  });
  if (id !== void 0)
    clearTimeout(id);
  if (response.status !== 200) {
    throw new JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response");
  }
  try {
    return await response.json();
  } catch {
    throw new JOSEError("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}, "fetchJwks");
var fetch_jwks_default = fetchJwks;

// node_modules/.pnpm/jose@5.10.0/node_modules/jose/dist/browser/jwks/remote.js
function isCloudflareWorkers() {
  return typeof WebSocketPair !== "undefined" || typeof navigator !== "undefined" && true || typeof EdgeRuntime !== "undefined" && EdgeRuntime === "vercel";
}
__name(isCloudflareWorkers, "isCloudflareWorkers");
var USER_AGENT;
if (typeof navigator === "undefined" || !"Cloudflare-Workers"?.startsWith?.("Mozilla/5.0 ")) {
  const NAME = "jose";
  const VERSION = "v5.10.0";
  USER_AGENT = `${NAME}/${VERSION}`;
}
var jwksCache = Symbol();
function isFreshJwksCache(input, cacheMaxAge) {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  if (!("uat" in input) || typeof input.uat !== "number" || Date.now() - input.uat >= cacheMaxAge) {
    return false;
  }
  if (!("jwks" in input) || !isObject(input.jwks) || !Array.isArray(input.jwks.keys) || !Array.prototype.every.call(input.jwks.keys, isObject)) {
    return false;
  }
  return true;
}
__name(isFreshJwksCache, "isFreshJwksCache");
var RemoteJWKSet = class {
  static {
    __name(this, "RemoteJWKSet");
  }
  constructor(url, options) {
    if (!(url instanceof URL)) {
      throw new TypeError("url must be an instance of URL");
    }
    this._url = new URL(url.href);
    this._options = { agent: options?.agent, headers: options?.headers };
    this._timeoutDuration = typeof options?.timeoutDuration === "number" ? options?.timeoutDuration : 5e3;
    this._cooldownDuration = typeof options?.cooldownDuration === "number" ? options?.cooldownDuration : 3e4;
    this._cacheMaxAge = typeof options?.cacheMaxAge === "number" ? options?.cacheMaxAge : 6e5;
    if (options?.[jwksCache] !== void 0) {
      this._cache = options?.[jwksCache];
      if (isFreshJwksCache(options?.[jwksCache], this._cacheMaxAge)) {
        this._jwksTimestamp = this._cache.uat;
        this._local = createLocalJWKSet(this._cache.jwks);
      }
    }
  }
  coolingDown() {
    return typeof this._jwksTimestamp === "number" ? Date.now() < this._jwksTimestamp + this._cooldownDuration : false;
  }
  fresh() {
    return typeof this._jwksTimestamp === "number" ? Date.now() < this._jwksTimestamp + this._cacheMaxAge : false;
  }
  async getKey(protectedHeader, token) {
    if (!this._local || !this.fresh()) {
      await this.reload();
    }
    try {
      return await this._local(protectedHeader, token);
    } catch (err) {
      if (err instanceof JWKSNoMatchingKey) {
        if (this.coolingDown() === false) {
          await this.reload();
          return this._local(protectedHeader, token);
        }
      }
      throw err;
    }
  }
  async reload() {
    if (this._pendingFetch && isCloudflareWorkers()) {
      this._pendingFetch = void 0;
    }
    const headers = new Headers(this._options.headers);
    if (USER_AGENT && !headers.has("User-Agent")) {
      headers.set("User-Agent", USER_AGENT);
      this._options.headers = Object.fromEntries(headers.entries());
    }
    this._pendingFetch || (this._pendingFetch = fetch_jwks_default(this._url, this._timeoutDuration, this._options).then((json) => {
      this._local = createLocalJWKSet(json);
      if (this._cache) {
        this._cache.uat = Date.now();
        this._cache.jwks = json;
      }
      this._jwksTimestamp = Date.now();
      this._pendingFetch = void 0;
    }).catch((err) => {
      this._pendingFetch = void 0;
      throw err;
    }));
    await this._pendingFetch;
  }
};
function createRemoteJWKSet(url, options) {
  const set = new RemoteJWKSet(url, options);
  const remoteJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "remoteJWKSet");
  Object.defineProperties(remoteJWKSet, {
    coolingDown: {
      get: /* @__PURE__ */ __name(() => set.coolingDown(), "get"),
      enumerable: true,
      configurable: false
    },
    fresh: {
      get: /* @__PURE__ */ __name(() => set.fresh(), "get"),
      enumerable: true,
      configurable: false
    },
    reload: {
      value: /* @__PURE__ */ __name(() => set.reload(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    },
    reloading: {
      get: /* @__PURE__ */ __name(() => !!set._pendingFetch, "get"),
      enumerable: true,
      configurable: false
    },
    jwks: {
      value: /* @__PURE__ */ __name(() => set._local?.jwks(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return remoteJWKSet;
}
__name(createRemoteJWKSet, "createRemoteJWKSet");

// src/routes/auth.ts
function cors(o) {
  return {
    "access-control-allow-origin": o ?? "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Admin-Key",
    "access-control-allow-credentials": "true"
  };
}
__name(cors, "cors");
var auth = new Hono2();
auth.options("*", (c) => c.body(null, 204, cors(c.req.header("Origin") || void 0)));
auth.get("/me", async (c) => {
  const origin = c.req.header("Origin") || void 0;
  const headers = cors(origin);
  const authz = c.req.header("Authorization") || "";
  const token = authz.replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "missing token" }, 401, headers);
  try {
    const jwksUrl = new URL("/auth/v1/keys", c.env.SUPABASE_URL).toString();
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    const userId = String(payload.sub || "");
    if (!userId) return c.json({ error: "invalid token" }, 401, headers);
    const { results } = await c.env.DB.prepare("SELECT role FROM users WHERE id = ? LIMIT 1").bind(userId).all();
    const role = results?.[0]?.role || "user";
    return c.json({ id: userId, role }, 200, headers);
  } catch (e) {
    return c.json({ error: "invalid token" }, 401, headers);
  }
});

// src/routes/admin/predictions.ts
var adminPredictions = new Hono2();
adminPredictions.use("*", async (c, next) => {
  const need = c.env.ADMIN_KEY;
  if (!need) {
    await next();
    return;
  }
  const got = c.req.header("x-admin-key");
  if (!got || got !== need) {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
});
adminPredictions.get("/fixtures", async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare(
    `
      SELECT
        f.id,
        f.kickoff_at,
        ht.name AS home_team_name,
        at.name AS away_team_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      ORDER BY f.kickoff_at DESC
    `
  ).all();
  const fixtures = (results ?? []).map((row) => {
    const d = new Date(row.kickoff_at);
    const dateLabel = d.toISOString().slice(0, 10);
    const label = `${dateLabel} \u2014 ${row.home_team_name} vs ${row.away_team_name}`;
    return {
      id: row.id,
      label
    };
  });
  return c.json({ fixtures });
});
adminPredictions.get("/fixture/:fixtureId", async (c) => {
  const db = c.env.DB;
  const fixtureId = c.req.param("fixtureId");
  if (!fixtureId) {
    return c.json({ error: "missing_fixture_id" }, 400);
  }
  const { results } = await db.prepare(
    `
      SELECT
        p.id,
        p.fixture_id,
        p.user_id,
        p.home_goals     AS pred_home,
        p.away_goals     AS pred_away,
        p.scorer_player_id,
        p.created_at,
        u.name           AS user_name,
        pl.name          AS scorer_name
      FROM predictions p
      JOIN users u
        ON u.id = p.user_id
      LEFT JOIN players pl
        ON pl.id = p.scorer_player_id
      WHERE p.fixture_id = ?
      ORDER BY p.created_at ASC
    `
  ).bind(fixtureId).all();
  const predictions = (results ?? []).map((row) => ({
    id: row.id,
    user_name: row.user_name ?? "(sem nome)",
    pred_home: row.pred_home,
    pred_away: row.pred_away,
    pred_scorer_name: row.scorer_name,
    // nome do marcador para o front
    created_at: row.created_at
  }));
  return c.json({ predictions });
});

// src/routes/fixtures-trends.ts
var fixtureTrends = new Hono2();
fixtureTrends.get("/fixtures/:fixtureId/trends", async (c) => {
  const fixtureId = c.req.param("fixtureId");
  const db = c.env.DB;
  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS total
       FROM predictions
       WHERE fixture_id = ?`
  ).bind(fixtureId).first();
  const total_predictions = totalRow?.total ?? 0;
  const { results: scoreRows } = await db.prepare(
    `SELECT home_goals, away_goals, COUNT(*) AS cnt
       FROM predictions
       WHERE fixture_id = ?
         AND home_goals IS NOT NULL
         AND away_goals IS NOT NULL
       GROUP BY home_goals, away_goals
       ORDER BY cnt DESC, home_goals DESC, away_goals DESC
       LIMIT 3`
  ).bind(fixtureId).all();
  const scores = (scoreRows ?? []).map((row) => {
    const count = row.cnt ?? 0;
    const pct = total_predictions > 0 ? Math.round(count * 100 / total_predictions) : 0;
    return {
      home: row.home_goals,
      away: row.away_goals,
      count,
      pct
    };
  }) ?? [];
  const { results: scorerRows } = await db.prepare(
    `SELECT p.scorer_player_id AS player_id,
              pl.name AS player_name,
              COUNT(*) AS cnt
       FROM predictions p
       LEFT JOIN players pl ON pl.id = p.scorer_player_id
       WHERE p.fixture_id = ?
         AND p.scorer_player_id IS NOT NULL
       GROUP BY p.scorer_player_id, pl.name
       ORDER BY cnt DESC, player_name ASC
       LIMIT 3`
  ).bind(fixtureId).all();
  const scorers = (scorerRows ?? []).map((row) => {
    const count = row.cnt ?? 0;
    const pct = total_predictions > 0 ? Math.round(count * 100 / total_predictions) : 0;
    return {
      player_id: String(row.player_id),
      name: row.player_name ?? "Desconhecido",
      count,
      pct
    };
  }) ?? [];
  return c.json({
    total_predictions,
    scores,
    scorers,
    // campos "single" só por conveniência / retrocompat
    most_common_score: scores[0] ?? null,
    most_common_scorer: scorers[0] ?? null
  });
});

// src/routes/admin/leagues.ts
var adminLeagues = new Hono2();
adminLeagues.use("/*", async (c, next) => {
  const sent = c.req.header("x-admin-key") || "";
  if (!sent || sent !== c.env.ADMIN_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
adminLeagues.get("/leagues", async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare(
    `
      SELECT
        l.*,
        COUNT(m.user_id) AS member_count
      FROM leagues l
      LEFT JOIN league_members m ON m.league_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
      `
  ).all();
  return c.json(rows.results ?? []);
});
adminLeagues.post("/leagues", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  const owner_user_id = (body.owner_user_id ?? "").trim();
  const start_mode = body.start_mode ?? "from_created";
  const start_date = body.start_date ?? null;
  const start_fixture_id = body.start_fixture_id ?? null;
  const competition_code = body.competition_code ?? null;
  if (!name || !owner_user_id) {
    return c.json(
      { error: "name and owner_user_id are required" },
      400
    );
  }
  const id = crypto.randomUUID();
  const join_code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO leagues (
          id, name, owner_user_id, join_code, visibility,
          start_mode, start_date, start_fixture_id, competition_code, created_at
        )
        VALUES (?, ?, ?, ?, 'private', ?, ?, ?, ?, ?)`
    ).bind(
      id,
      name,
      owner_user_id,
      join_code,
      start_mode,
      start_date,
      start_fixture_id,
      competition_code,
      now
    ),
    db.prepare(
      `INSERT INTO league_members (league_id, user_id, joined_at, is_owner)
         VALUES (?, ?, ?, 1)`
    ).bind(id, owner_user_id, now)
  ]);
  return c.json({
    id,
    name,
    owner_user_id,
    join_code,
    start_mode,
    start_date,
    start_fixture_id,
    competition_code,
    created_at: now
  });
});
adminLeagues.get("/leagues/:leagueId", async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param("leagueId");
  const league = await db.prepare("SELECT * FROM leagues WHERE id = ?").bind(leagueId).first();
  if (!league) {
    return c.json({ error: "not_found" }, 404);
  }
  const members = await db.prepare(
    `
      SELECT lm.user_id, lm.joined_at, lm.is_owner,
             u.name, u.email
      FROM league_members lm
      LEFT JOIN users u ON u.id = lm.user_id
      WHERE lm.league_id = ?
      ORDER BY lm.is_owner DESC, lm.joined_at ASC
      `
  ).bind(leagueId).all();
  return c.json({
    league,
    members: members.results ?? []
  });
});

// src/routes/leagues.ts
var leagues = new Hono2();
function jsonError(c, status, message2) {
  return c.json({ error: message2 }, status);
}
__name(jsonError, "jsonError");
leagues.get("/leagues", async (c) => {
  const db = c.env.DB;
  const userId = c.req.query("userId");
  if (!userId) return jsonError(c, 400, "Missing userId");
  const result = await db.prepare(
    `SELECT
         l.id,
         l.name,
         l.code,
         l.visibility,
         l.owner_id,
         m.role
       FROM league_members m
       JOIN leagues l ON l.id = m.league_id
       WHERE m.user_id = ?
       ORDER BY l.name`
  ).bind(userId).all();
  return c.json(result.results ?? []);
});
leagues.get("/leagues/public", async (c) => {
  const db = c.env.DB;
  const userId = c.req.query("userId");
  if (!userId) return jsonError(c, 400, "Missing userId");
  const result = await db.prepare(
    `
      SELECT
        l.id,
        l.name,
        l.code,
        l.visibility,
        l.owner_id,
        EXISTS (
          SELECT 1
          FROM league_members lm
          WHERE lm.league_id = l.id
            AND lm.user_id = ?
        ) AS is_member
      FROM leagues l
      WHERE l.visibility = 'public'
      ORDER BY l.name
      `
  ).bind(userId).all();
  const rows = result.results?.map((r) => ({
    ...r,
    is_member: !!r.is_member
  })) ?? [];
  return c.json(rows);
});
leagues.post("/leagues", async (c) => {
  const db = c.env.DB;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "Invalid JSON");
  }
  const userId = String(body.userId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const visibility = String(body.visibility ?? "private").toLowerCase() === "public" ? "public" : "private";
  if (!userId) return jsonError(c, 400, "Missing userId");
  if (!name) return jsonError(c, 400, "Missing name");
  const id = crypto.randomUUID();
  const code = body.code?.trim().toUpperCase() || id.replace(/-/g, "").toUpperCase().slice(0, 6);
  await db.batch([
    db.prepare(
      `INSERT INTO leagues (id, owner_id, name, code, visibility)
         VALUES (?, ?, ?, ?, ?)`
    ).bind(id, userId, name, code, visibility),
    db.prepare(
      `INSERT INTO league_members (league_id, user_id, role)
         VALUES (?, ?, ?)`
    ).bind(id, userId, "owner")
  ]);
  return c.json(
    {
      id,
      name,
      code,
      visibility,
      owner_id: userId,
      role: "owner"
    },
    201
  );
});
leagues.post("/leagues/join", async (c) => {
  const db = c.env.DB;
  let body = {};
  try {
    body = await c.req.json();
  } catch {
  }
  const userId = String(body.userId ?? c.req.query("userId") ?? "").trim();
  const rawCode = String(body.code ?? c.req.query("code") ?? "").trim();
  if (!userId) return jsonError(c, 400, "Missing userId");
  if (!rawCode) return jsonError(c, 400, "Missing code");
  const code = rawCode.toUpperCase();
  const league = await db.prepare(
    `SELECT id, name, code, visibility, owner_id
       FROM leagues
       WHERE UPPER(code) = ?`
  ).bind(code).first();
  if (!league) return jsonError(c, 404, "Liga n\xE3o encontrada");
  await db.prepare(
    `INSERT OR IGNORE INTO league_members (league_id, user_id, role)
       VALUES (?, ?, ?)`
  ).bind(league.id, userId, "member").run();
  return c.json({
    ...league,
    role: userId === league.owner_id ? "owner" : "member"
  });
});
leagues.get("/leagues/:leagueId", async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param("leagueId");
  const userId = c.req.query("userId");
  if (!userId) return jsonError(c, 400, "Missing userId");
  const league = await db.prepare(
    `SELECT id, name, code, visibility, owner_id, ranking_from
       FROM leagues
       WHERE id = ?`
  ).bind(leagueId).first();
  if (!league) return jsonError(c, 404, "league_not_found");
  const membersRes = await db.prepare(
    `
      SELECT
        lm.user_id,
        lm.role,
        COALESCE(u.name,
          CASE
            WHEN u.email IS NULL THEN 'Jogador'
            ELSE substr(u.email, 1, instr(u.email, '@') - 1)
          END
        ) AS name
      FROM league_members lm
      JOIN users u ON u.id = lm.user_id
      WHERE lm.league_id = ?
      ORDER BY (lm.user_id = ?) DESC, lm.role DESC, name ASC
      `
  ).bind(leagueId, userId).all();
  const currentMembership = membersRes.results.find(
    (m) => m.user_id === userId
  );
  const currentUserRole = currentMembership?.role ?? null;
  return c.json({
    league,
    members: membersRes.results,
    currentUserRole
  });
});
leagues.patch("/leagues/:leagueId", async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param("leagueId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "Invalid JSON");
  }
  const userId = String(body.userId ?? "").trim();
  const name = body.name != null ? String(body.name).trim() : void 0;
  const visibilityRaw = body.visibility != null ? String(body.visibility).toLowerCase() : void 0;
  if (!userId) return jsonError(c, 400, "Missing userId");
  const league = await db.prepare(
    `SELECT id, owner_id
       FROM leagues
       WHERE id = ?`
  ).bind(leagueId).first();
  if (!league) return jsonError(c, 404, "league_not_found");
  if (league.owner_id !== userId)
    return jsonError(c, 403, "not_owner");
  const updates = [];
  const params = [];
  if (name !== void 0) {
    updates.push("name = ?");
    params.push(name);
  }
  if (visibilityRaw !== void 0) {
    const vis = visibilityRaw === "public" ? "public" : "private";
    updates.push("visibility = ?");
    params.push(vis);
  }
  const hasRankingFromField = Object.prototype.hasOwnProperty.call(
    body,
    "ranking_from"
  );
  if (hasRankingFromField) {
    const raw2 = body.ranking_from;
    let rankingFrom = null;
    if (raw2 != null && String(raw2).trim() !== "") {
      rankingFrom = String(raw2).trim();
    }
    updates.push("ranking_from = ?");
    params.push(rankingFrom);
  }
  if (updates.length === 0) {
    return jsonError(c, 400, "Nothing to update");
  }
  params.push(leagueId);
  await db.prepare(
    `UPDATE leagues
       SET ${updates.join(", ")}
       WHERE id = ?`
  ).bind(...params).run();
  return c.json({ ok: true });
});
leagues.delete("/leagues/:leagueId", async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param("leagueId");
  let body = {};
  try {
    body = await c.req.json();
  } catch {
  }
  const userId = String(body.userId ?? "").trim();
  if (!userId) return jsonError(c, 400, "Missing userId");
  const league = await db.prepare(
    `SELECT id, owner_id FROM leagues WHERE id = ?`
  ).bind(leagueId).first();
  if (!league) return jsonError(c, 404, "league_not_found");
  if (league.owner_id !== userId)
    return jsonError(c, 403, "not_owner");
  await db.batch([
    db.prepare(
      `DELETE FROM league_members WHERE league_id = ?`
    ).bind(leagueId),
    db.prepare(`DELETE FROM leagues WHERE id = ?`).bind(leagueId)
  ]);
  return c.json({ ok: true });
});
leagues.delete("/leagues/:leagueId/members/:memberUserId", async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param("leagueId");
  const memberUserId = c.req.param("memberUserId");
  let body = {};
  try {
    body = await c.req.json();
  } catch {
  }
  const userId = String(body.userId ?? "").trim();
  if (!userId) return jsonError(c, 400, "Missing userId");
  const league = await db.prepare(
    `SELECT id, owner_id FROM leagues WHERE id = ?`
  ).bind(leagueId).first();
  if (!league) return jsonError(c, 404, "league_not_found");
  const isSelf = userId === memberUserId;
  const isOwner = league.owner_id === userId;
  if (!isSelf && !isOwner) {
    return jsonError(c, 403, "forbidden");
  }
  await db.prepare(
    `DELETE FROM league_members
       WHERE league_id = ?
         AND user_id = ?`
  ).bind(leagueId, memberUserId).run();
  return c.json({ ok: true });
});
leagues.get("/leagues/:leagueId/ranking", async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param("leagueId");
  if (!leagueId) {
    return jsonError(c, 400, "Missing leagueId");
  }
  try {
    const league = await db.prepare(
      `SELECT id, name, code, visibility, ranking_from
         FROM leagues
         WHERE id = ?`
    ).bind(leagueId).first();
    if (!league) {
      return jsonError(c, 404, "league_not_found");
    }
    const rowsRes = await db.prepare(
      `
        SELECT
          u.id AS user_id,
          COALESCE(
            u.name,
            CASE
              WHEN u.email IS NULL THEN 'Jogador'
              ELSE substr(u.email, 1, instr(u.email, '@') - 1)
            END
          ) AS display_name,
          u.avatar_url,
          COALESCE(SUM(p.points), 0) AS total_points
        FROM league_members lm
        JOIN users u
          ON u.id = lm.user_id
        LEFT JOIN predictions p
          ON p.user_id = u.id
        LEFT JOIN fixtures f
          ON f.id = p.fixture_id
        JOIN leagues l
          ON l.id = lm.league_id
        WHERE lm.league_id = ?
          AND (
            p.id IS NULL
            OR l.ranking_from IS NULL
            OR f.kickoff_at >= l.ranking_from
          )
        GROUP BY u.id, display_name, u.avatar_url
        ORDER BY total_points DESC, display_name ASC
        `
    ).bind(leagueId).all();
    const rows = rowsRes.results ?? [];
    const ranking = rows.map((row, idx) => ({
      user_id: row.user_id,
      name: row.display_name,
      avatar_url: row.avatar_url,
      total_points: row.total_points,
      position: idx + 1
    }));
    return c.json({
      league,
      ranking
    });
  } catch (err) {
    console.error("Error loading league ranking", err);
    return jsonError(
      c,
      500,
      err?.message || "Failed to load league ranking"
    );
  }
});

// src/index.ts
var app = new Hono2();
app.use("*", corsMiddleware);
function requireAdmin2(c) {
  const need = c.env.ADMIN_KEY;
  if (!need) return void 0;
  const got = c.req.header("x-admin-key");
  if (!got || got !== need) return c.json({ error: "forbidden" }, 403);
  return void 0;
}
__name(requireAdmin2, "requireAdmin");
var run2 = /* @__PURE__ */ __name((db, sql, ...args) => db.prepare(sql).bind(...args).run(), "run");
var all2 = /* @__PURE__ */ __name((db, sql, ...args) => db.prepare(sql).bind(...args).all(), "all");
var getLockMs = /* @__PURE__ */ __name((c) => {
  const mins = Number(c.env.LOCK_MINUTES_BEFORE ?? "0");
  return Number.isFinite(mins) ? mins * 6e4 : 0;
}, "getLockMs");
var isLocked = /* @__PURE__ */ __name((kickoffISO, nowMs, lockMs) => {
  const ko = new Date(kickoffISO).getTime();
  return nowMs >= ko - lockMs;
}, "isLocked");
app.get("/health", (c) => c.text("ok"));
app.get(
  "/routes",
  (c) => c.json({
    ok: true,
    routes: [
      "/health",
      "/routes",
      "/api/matchdays/:id/fixtures",
      "/api/predictions",
      "/api/users/sync",
      "/api/admin/teams",
      "/api/admin/fixtures",
      "/api/admin/fixtures/porto",
      "/api/admin/competitions",
      "/api/admin/players",
      "/api/admin/predictions",
      "/api/admin/users"
    ]
  })
);
app.route("/api/rankings", rankings);
app.route("/api/admin/competitions", adminCompetitions);
app.route("/api/admin/players", adminPlayers);
app.route("/api/admin/fixtures", adminFixtureScorers);
app.route("/api/auth", auth);
app.route("/api/admin", admin);
app.route("/api/admin/teams", adminTeams);
app.route("/api/admin/predictions", adminPredictions);
app.route("/api", fixtureTrends);
app.route("/api/admin", adminLeagues);
app.route("/api", leagues);
async function listFixtures(c, matchdayId) {
  const lockMs = getLockMs(c);
  const now = Date.now();
  const { results } = await c.env.DB.prepare(
    `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'SCHEDULED'
      ORDER BY f.kickoff_at ASC
    `
  ).all();
  const lockMsLocal = lockMs;
  const enriched = (results ?? []).map((f) => {
    const koMs = new Date(f.kickoff_at).getTime();
    return {
      ...f,
      is_locked: isLocked(f.kickoff_at, now, lockMsLocal),
      lock_at_utc: new Date(koMs - lockMsLocal).toISOString()
    };
  });
  return c.json(enriched);
}
__name(listFixtures, "listFixtures");
app.get("/api/fixtures/open", async (c) => {
  const lockMs = getLockMs(c);
  const now = Date.now();
  const { results } = await c.env.DB.prepare(
    `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'SCHEDULED'
      ORDER BY f.kickoff_at ASC
    `
  ).all();
  const enriched = (results ?? []).map((f) => {
    const koMs = new Date(f.kickoff_at).getTime();
    return {
      ...f,
      is_locked: isLocked(f.kickoff_at, now, lockMs),
      lock_at_utc: new Date(koMs - lockMs).toISOString()
    };
  });
  return c.json(enriched);
});
app.get(
  "/api/matchdays/:id/fixtures",
  (c) => listFixtures(c, c.req.param("id"))
);
app.get("/api/matchdays/md1/fixtures", (c) => listFixtures(c, "md1"));
app.get("/api/fixtures/finished", async (c) => {
  const limitQ = Number(c.req.query("limit") ?? "10");
  const offsetQ = Number(c.req.query("offset") ?? "0");
  const limit = Number.isFinite(limitQ) ? Math.min(Math.max(limitQ, 1), 100) : 10;
  const offset = Number.isFinite(offsetQ) ? Math.max(offsetQ, 0) : 0;
  const { results } = await c.env.DB.prepare(
    `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'FINISHED'
      ORDER BY f.kickoff_at DESC
      LIMIT ? OFFSET ?
    `
  ).bind(limit, offset).all();
  return c.json(results ?? []);
});
app.get("/api/fixtures/closed", async (c) => {
  const limitQ = Number(c.req.query("limit") ?? "10");
  const offsetQ = Number(c.req.query("offset") ?? "0");
  const limit = Number.isFinite(limitQ) ? Math.min(Math.max(limitQ, 1), 100) : 10;
  const offset = Number.isFinite(offsetQ) ? Math.max(offsetQ, 0) : 0;
  const lockMinutes = Number(c.env.LOCK_MINUTES_BEFORE ?? "0");
  const lockStr = String(Number.isFinite(lockMinutes) ? lockMinutes : 0);
  const { results } = await c.env.DB.prepare(
    `
      SELECT 
        f.id,
        f.kickoff_at,
        f.home_score,
        f.away_score,
        f.status,
        f.competition_id,
        f.round_label,
        f.leg AS leg,
        ht.name       AS home_team_name,
        at.name       AS away_team_name,
        ht.crest_url  AS home_crest,
        at.crest_url  AS away_crest,
        co.code       AS competition_code,
        co.name       AS competition_name,
        GROUP_CONCAT(p.name, ',') AS scorers_names
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions    co ON co.id = f.competition_id
      LEFT JOIN fixture_scorers fs ON fs.fixture_id = f.id
      LEFT JOIN players         p  ON p.id = fs.player_id
      WHERE f.status = 'FINISHED'
         OR DATETIME('now') >= DATETIME(f.kickoff_at, '-' || ? || ' minutes')
      GROUP BY f.id
      ORDER BY f.kickoff_at DESC
      LIMIT ? OFFSET ?
    `
  ).bind(lockStr, limit, offset).all();
  const rows = results ?? [];
  const enriched = rows.map((r) => ({
    ...r,
    scorers_names: r.scorers_names ? r.scorers_names.split(",").map((s) => s.trim()).filter(Boolean) : []
  }));
  return c.json(enriched);
});
app.post("/api/predictions", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    const { fixtureId, home, away, userId, scorer_player_id } = body;
    if (!fixtureId || !userId || home == null || away == null) {
      return c.json({ error: "missing_data" }, 400);
    }
    let scorerId = null;
    if (typeof scorer_player_id === "string") {
      const t = scorer_player_id.trim();
      scorerId = t || null;
    } else if (typeof scorer_player_id === "number" && Number.isFinite(scorer_player_id)) {
      scorerId = String(scorer_player_id);
    }
    const db = c.env.DB;
    const userExists = await db.prepare(`SELECT 1 FROM users WHERE id = ? LIMIT 1`).bind(userId).first();
    if (!userExists) return c.json({ error: "user_missing" }, 400);
    const fx = await db.prepare(
      `SELECT kickoff_at, status
         FROM fixtures
         WHERE id = ?
         LIMIT 1`
    ).bind(fixtureId).first();
    if (!fx) return c.json({ error: "fixture_not_found" }, 404);
    const lockMs = getLockMs(c);
    if (fx.status === "FINISHED" || isLocked(fx.kickoff_at, Date.now(), lockMs)) {
      return c.json({ error: "locked" }, 400);
    }
    const updateRes = await db.prepare(
      `
        UPDATE predictions
        SET home_goals = ?, away_goals = ?, scorer_player_id = ?
        WHERE user_id = ? AND fixture_id = ?
      `
    ).bind(home, away, scorerId, userId, fixtureId).run();
    let mode = "update";
    if (!updateRes.meta?.changes) {
      const insertRes = await db.prepare(
        `
          INSERT INTO predictions (
            id,
            user_id,
            fixture_id,
            home_goals,
            away_goals,
            scorer_player_id,
            created_at
          )
          VALUES (
            lower(hex(randomblob(16))),
            ?, ?, ?, ?, ?, DATETIME('now')
          )
        `
      ).bind(userId, fixtureId, home, away, scorerId).run();
      mode = "insert";
    }
    return c.json({ success: true, mode });
  } catch (e) {
    console.error("POST /api/predictions ERROR", e?.message, e?.stack);
    return c.json({ error: "internal_error", detail: String(e) }, 500);
  }
});
app.get("/api/predictions", async (c) => {
  try {
    const userId = c.req.query("userId");
    if (!userId) {
      return c.json([], 200);
    }
    const { results } = await c.env.DB.prepare(
      `
        SELECT
          fixture_id,
          home_goals,
          away_goals,
          points,
          scorer_player_id
        FROM predictions
        WHERE user_id = ?
      `
    ).bind(userId).all();
    const safe = (results ?? []).map((r) => ({
      fixture_id: String(r.fixture_id),
      home_goals: r.home_goals ?? 0,
      away_goals: r.away_goals ?? 0,
      points: r.points,
      scorer_player_id: r.scorer_player_id ?? null,
      scorerPlayerId: r.scorer_player_id ?? null
    }));
    return c.json(safe, 200);
  } catch (e) {
    console.error("GET /api/predictions error:", e);
    return c.json({ error: "internal_error" }, 500);
  }
});
app.get("/api/fixtures/:id/trends", async (c) => {
  const fixtureId = c.req.param("id");
  if (!fixtureId) {
    return c.json({ error: "missing_fixture_id" }, 400);
  }
  const db = c.env.DB;
  const totalRow = await db.prepare(
    `
      SELECT COUNT(*) AS total
      FROM predictions
      WHERE fixture_id = ?
    `
  ).bind(fixtureId).first();
  const total_predictions = totalRow?.total ?? 0;
  const scoreRow = await db.prepare(
    `
      SELECT 
        home_goals,
        away_goals,
        COUNT(*) AS count
      FROM predictions
      WHERE fixture_id = ?
      GROUP BY home_goals, away_goals
      ORDER BY count DESC
      LIMIT 1
    `
  ).bind(fixtureId).first();
  const most_common_score = scoreRow && scoreRow.home_goals != null && scoreRow.away_goals != null ? {
    home: Number(scoreRow.home_goals),
    away: Number(scoreRow.away_goals),
    count: Number(scoreRow.count)
  } : null;
  const scorerRow = await db.prepare(
    `
      SELECT
        p.id   AS player_id,
        p.name AS name,
        COUNT(*) AS count
      FROM predictions pr
      JOIN players p ON p.id = pr.scorer_player_id
      WHERE pr.fixture_id = ?
      GROUP BY p.id, p.name
      ORDER BY count DESC
      LIMIT 1
    `
  ).bind(fixtureId).first();
  const most_common_scorer = scorerRow ? {
    player_id: String(scorerRow.player_id),
    name: scorerRow.name ?? "Jogador",
    count: Number(scorerRow.count)
  } : null;
  return c.json(
    {
      total_predictions,
      most_common_score,
      most_common_scorer
    },
    200
  );
});
app.post("/api/users/sync", async (c) => {
  try {
    const b = await c.req.json();
    if (!b?.id) return c.json({ error: "missing_id" }, 400);
    await c.env.DB.prepare(
      `
      INSERT INTO users (id, email, name, avatar_url, role, created_at, updated_at, last_login)
      VALUES (?, ?, ?, ?, 'user', DATETIME('now'), DATETIME('now'), DATETIME('now'))
      ON CONFLICT(id) DO UPDATE SET
        email=COALESCE(excluded.email, users.email),
        name=COALESCE(excluded.name, users.name),
        avatar_url=COALESCE(excluded.avatar_url, users.avatar_url),
        updated_at=DATETIME('now'),
        last_login=DATETIME('now')
    `
    ).bind(b.id, b.email ?? null, b.name ?? null, b.avatar_url ?? null).run();
    return c.json({ ok: true });
  } catch (e) {
    console.error("Erro /api/users/sync:", e);
    return c.json({ error: "sync_failed" }, 500);
  }
});
app.get("/api/players", async (c) => {
  const { results } = await c.env.DB.prepare(
    `
      SELECT id, team_id, name, position
      FROM players
      WHERE is_active = 1
      ORDER BY
        CASE position
          WHEN 'GR' THEN 1
          WHEN 'D'  THEN 2
          WHEN 'M'  THEN 3
          WHEN 'A'  THEN 4
          ELSE 5
        END,
        name
    `
  ).all();
  return c.json(results ?? []);
});
app.get("/api/admin/users", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const { results } = await all2(
    c.env.DB,
    `
    SELECT
      id,
      email,
      name,
      avatar_url,
      role,
      created_at,
      updated_at,
      last_login
    FROM users
    ORDER BY created_at DESC
    `
  );
  return c.json(results ?? []);
});
app.patch("/api/admin/users/:id", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing_id" }, 400);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid_json" }, 400);
  await run2(
    c.env.DB,
    `
    UPDATE users
    SET
      email      = COALESCE(?, email),
      name       = COALESCE(?, name),
      avatar_url = COALESCE(?, avatar_url),
      role       = COALESCE(?, role),
      updated_at = DATETIME('now')
    WHERE id = ?
    `,
    body.email ?? null,
    body.name ?? null,
    body.avatar_url ?? null,
    body.role ?? null,
    id
  );
  return c.json({ ok: true });
});
app.delete("/api/admin/users/:id", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing_id" }, 400);
  await run2(
    c.env.DB,
    `DELETE FROM predictions WHERE user_id = ?`,
    id
  );
  await run2(
    c.env.DB,
    `DELETE FROM users WHERE id = ?`,
    id
  );
  return c.json({ ok: true });
});
app.get("/api/admin/teams", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const { results } = await all2(
    c.env.DB,
    `
    SELECT
      id,
      name,
      short_name,
      crest_url
    FROM teams
    ORDER BY name
    `
  );
  return c.json(results ?? []);
});
app.post("/api/admin/teams", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.name) {
    return c.json({ error: "missing_id_or_name" }, 400);
  }
  await run2(
    c.env.DB,
    `
    INSERT INTO teams (id, name, short_name, crest_url)
    VALUES (?, ?, ?, ?)
    `,
    body.id.trim(),
    body.name.trim(),
    body.short_name?.trim() || null,
    body.crest_url?.trim() || null
  );
  return c.json({ ok: true });
});
app.patch("/api/admin/teams/:id", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!id) return c.json({ error: "missing_id" }, 400);
  if (!body) return c.json({ error: "invalid_json" }, 400);
  await run2(
    c.env.DB,
    `
    UPDATE teams
    SET
      name       = COALESCE(?, name),
      short_name = COALESCE(?, short_name),
      crest_url  = COALESCE(?, crest_url)
    WHERE id = ?
    `,
    body.name ?? null,
    body.short_name ?? null,
    body.crest_url ?? null,
    id
  );
  return c.json({ ok: true });
});
app.delete("/api/admin/teams/:id", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing_id" }, 400);
  await run2(
    c.env.DB,
    `
    DELETE FROM fixtures
    WHERE home_team_id = ? OR away_team_id = ?
    `,
    id,
    id
  );
  await run2(c.env.DB, `DELETE FROM teams WHERE id = ?`, id);
  return c.json({ ok: true });
});
app.get("/api/admin/check", (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  return c.json({ ok: true });
});
app.get("/api/admin/fixtures", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const { results } = await c.env.DB.prepare(
    `
      SELECT f.*, ht.name AS home_name, at.name AS away_name,
             co.code AS competition_code
      FROM fixtures f
      JOIN teams ht ON ht.id=f.home_team_id
      JOIN teams at ON at.id=f.away_team_id
      LEFT JOIN competitions co ON co.id=f.competition_id
      ORDER BY f.kickoff_at DESC
    `
  ).all();
  return c.json(results ?? []);
});
app.post("/api/admin/fixtures", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  try {
    const b = await c.req.json();
    const genId = /* @__PURE__ */ __name(() => "g" + crypto.getRandomValues(new Uint8Array(3)).reduce((s, n) => s + n.toString(16).padStart(2, "0"), ""), "genId");
    const id = b.id && String(b.id) || genId();
    if (!b.home_team_id || !b.away_team_id)
      return c.json({ error: "missing_team" }, 400);
    if (b.home_team_id === b.away_team_id)
      return c.json({ error: "same_team" }, 400);
    if (!b.kickoff_at) return c.json({ error: "missing_kickoff" }, 400);
    const competition_id = b.competition_id ?? null;
    const round_label = b.round_label ?? null;
    const leg = b.leg_number ?? b.leg ?? null;
    const matchday_id = b.matchday_id ?? "md1";
    await run2(
      c.env.DB,
      `INSERT INTO fixtures (
         id, matchday_id,
         competition_id, round_label, leg,
         home_team_id, away_team_id,
         kickoff_at, status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'SCHEDULED'))`,
      id,
      matchday_id,
      competition_id,
      round_label,
      leg,
      b.home_team_id,
      b.away_team_id,
      b.kickoff_at,
      b.status ?? null
    );
    return c.json({ ok: true, id });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("POST /api/admin/fixtures failed:", msg);
    return c.json({ error: "create_failed", detail: msg }, 500);
  }
});
app.patch("/api/admin/fixtures/:id", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  const b = await c.req.json();
  const touchesScore = "home_score" in b || "away_score" in b;
  await run2(
    c.env.DB,
    `UPDATE fixtures SET
       home_team_id   = COALESCE(?, home_team_id),
       away_team_id   = COALESCE(?, away_team_id),
       kickoff_at     = COALESCE(?, kickoff_at),
       status         = COALESCE(?, status),
       competition_id = COALESCE(?, competition_id),
       round_label    = COALESCE(?, round_label),
       leg            = COALESCE(?, leg),
       home_score     = COALESCE(?, home_score),
       away_score     = COALESCE(?, away_score)
     WHERE id=?`,
    b.home_team_id ?? null,
    b.away_team_id ?? null,
    b.kickoff_at ?? null,
    b.status ?? null,
    b.competition_id ?? null,
    b.round_label ?? null,
    b.leg_number ?? b.leg ?? null,
    b.home_score ?? null,
    b.away_score ?? null,
    id
  );
  if (touchesScore) {
    await recomputePointsForFixture(c.env.DB, id);
  }
  return c.json({ ok: true });
});
app.delete("/api/admin/fixtures/:id", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  await run2(c.env.DB, `DELETE FROM predictions WHERE fixture_id=?`, id);
  await run2(c.env.DB, `DELETE FROM fixtures WHERE id=?`, id);
  return c.json({ ok: true });
});
app.patch("/api/admin/fixtures/:id/result", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  const { home_score, away_score } = await c.req.json();
  await run2(
    c.env.DB,
    `UPDATE fixtures SET home_score=?, away_score=?, status='FINISHED' WHERE id=?`,
    Number(home_score),
    Number(away_score),
    id
  );
  await recomputePointsForFixture(c.env.DB, id);
  return c.json({ ok: true });
});
app.patch("/api/admin/fixtures/:id/reopen", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const id = c.req.param("id");
  await run2(
    c.env.DB,
    `UPDATE fixtures SET home_score=NULL, away_score=NULL, status='SCHEDULED' WHERE id=?`,
    id
  );
  return c.json({ ok: true });
});
app.get("/api/admin/fixtures/:id/scorers", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const fixtureId = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `
      SELECT 
        fs.player_id,
        p.name,
        p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
      ORDER BY 
        CASE p.position
          WHEN 'GR' THEN 1
          WHEN 'D'  THEN 2
          WHEN 'M'  THEN 3
          WHEN 'A'  THEN 4
          ELSE 5
        END,
        p.name
    `
  ).bind(fixtureId).all();
  return c.json(results ?? []);
});
app.put("/api/admin/fixtures/:id/scorers", async (c) => {
  const guard = requireAdmin2(c);
  if (guard) return guard;
  const fixtureId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const ids = Array.isArray(body?.player_ids) ? body.player_ids.map((x) => String(x)).filter(Boolean) : [];
  await run2(c.env.DB, `DELETE FROM fixture_scorers WHERE fixture_id = ?`, fixtureId);
  for (const pid of ids) {
    await run2(
      c.env.DB,
      `
      INSERT INTO fixture_scorers (id, fixture_id, player_id, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, DATETIME('now'))
    `,
      fixtureId,
      pid
    );
  }
  await recomputePointsForFixture(c.env.DB, fixtureId);
  return c.json({ ok: true, count: ids.length });
});
app.get("/api/users/:id/role", async (c) => {
  const userId = c.req.param("id");
  if (!userId) return c.json({ role: null }, 400);
  const row = await c.env.DB.prepare(`SELECT role FROM users WHERE id = ? LIMIT 1`).bind(userId).first();
  return c.json({ role: row?.role ?? null });
});
app.get("/api/users/role/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing_user" }, 400);
  const row = await c.env.DB.prepare(`SELECT role FROM users WHERE id = ? LIMIT 1`).bind(id).first();
  return c.json({ role: row?.role ?? "user" });
});
app.get("/api/users/:id/last-points", async (c) => {
  const userId = c.req.param("id");
  if (!userId) return c.json(null, 400);
  const db = c.env.DB;
  const last = await db.prepare(
    `
      SELECT 
        p.fixture_id,
        f.kickoff_at,
        f.home_score,
        f.away_score
      FROM predictions p
      JOIN fixtures f ON f.id = p.fixture_id
      WHERE 
        p.user_id = ?
        AND f.status = 'FINISHED'
        AND f.home_score IS NOT NULL
        AND f.away_score IS NOT NULL
      ORDER BY f.kickoff_at DESC
      LIMIT 1
    `
  ).bind(userId).first();
  if (!last) {
    return c.json(null);
  }
  const { fixture_id, kickoff_at, home_score, away_score } = last;
  const { results } = await db.prepare(
    `
      SELECT user_id, home_goals, away_goals, points
      FROM predictions
      WHERE fixture_id = ?
    `
  ).bind(fixture_id).all();
  const table = (results ?? []).map((r) => {
    const s = scoreUEFA(
      r.home_goals ?? 0,
      r.away_goals ?? 0,
      home_score,
      away_score
    );
    const pts = typeof r.points === "number" ? r.points : s.points;
    return {
      user_id: r.user_id,
      points: pts,
      exact: s.exact ?? 0,
      diff: s.diff ?? 0,
      winner: s.winner ?? 0
    };
  });
  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return 0;
  });
  const idx = table.findIndex((r) => r.user_id === userId);
  const me = idx >= 0 ? table[idx] : null;
  if (!me) {
    return c.json(null);
  }
  const payload = {
    points: me.points,
    exact: me.exact,
    diff: me.diff,
    winner: me.winner,
    position: idx + 1,
    fixture: {
      id: fixture_id,
      kickoff_at
    }
  };
  return c.json(payload);
});
var src_default = app;

// C:/Users/Ricardo/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Ricardo/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError2;

// .wrangler/tmp/bundle-ydVUay/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/Ricardo/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ydVUay/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
