import * as basicAuth from 'express-basic-auth';
export function BasicAuthFunction(username, password, exclude) {
  function authFunction(req, res, next) {
    if (req.url.startsWith(exclude)) {
      next();
      return;
    }
    const auth = basicAuth({
      challenge: true,
      users: {
        [username]: password,
      },
    });
    auth(req, res, next);
  }
  return authFunction;
}
