// Lets plain Node (22+, --experimental-strip-types) import the project's
// extensionless TypeScript modules for the text audit.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if (specifier.startsWith(".")) return next(specifier + ".ts", context);
    throw e;
  }
}
