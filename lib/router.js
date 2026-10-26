'use strict';
// Minimaler Router: route('GET', '/api/boards/:id', handler)

class Router {
  constructor() {
    this.routes = [];
  }

  route(method, pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    }) + '/?$');
    this.routes.push({ method, re, keys, handler });
  }

  match(method, pathname) {
    let allowed = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      if (r.method !== method) {
        allowed = true;
        continue;
      }
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return allowed ? { methodNotAllowed: true } : null;
  }
}

module.exports = { Router };
