/**
 * Lets `node --experimental-strip-types` resolve the extensionless relative
 * imports that the bundler resolves for us inside `src/`.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$|\.json$/i.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // fall through to the default resolution below
    }
  }
  return next(specifier, context);
}
