import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { safeInternalRedirectPath } from "../lib/security/safe-redirect.ts";

assert.equal(safeInternalRedirectPath("/dashboard"), "/dashboard");
assert.equal(safeInternalRedirectPath("/dashboard?tab=leads#today"), "/dashboard?tab=leads#today");
assert.equal(safeInternalRedirectPath("https://evil.example/phishing"), "/dashboard");
assert.equal(safeInternalRedirectPath("//evil.example/phishing"), "/dashboard");
assert.equal(safeInternalRedirectPath("/\\\\evil.example/phishing"), "/dashboard");
assert.equal(safeInternalRedirectPath("javascript:alert(1)"), "/dashboard");
assert.equal(safeInternalRedirectPath("\n//evil.example"), "/dashboard");
assert.equal(safeInternalRedirectPath(null), "/dashboard");
assert.equal(safeInternalRedirectPath("/super-admin", "/dashboard"), "/super-admin");


const callbackSource = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
assert.match(callbackSource, /safeInternalRedirectPath\\(requestedNext, defaultDestination\\)/,
  "OAuth callback must use the tested safe-redirect helper");
assert.doesNotMatch(callbackSource, /new URL\\(destination, url\\.origin\\)/,
  "OAuth callback must not pass unsanitized query destinations to new URL");

console.log("Safe redirect tests passed.");
