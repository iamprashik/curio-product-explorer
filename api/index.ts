import catalogue from "../public/catalogue.json" with { type: "json" };
import { isProducts } from "../src/lib/api.ts";
import { createHostedHandler } from "../server/hosted.ts";

// A static import bundles the sample catalogue with the function. It does not
// depend on a writable filesystem or a deployed public-directory location.
const handler = createHostedHandler(async () => {
  const value: unknown = catalogue;
  if (!isProducts(value) || !value.length) throw new Error("Invalid catalogue");
  return value;
});

export default handler;
