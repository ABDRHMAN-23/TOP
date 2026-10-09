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

console.log("Safe redirect tests passed.");
