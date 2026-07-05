import { describe, expect, it } from "vitest";

import arAuth from "../locales/ar/auth.json";
import enAuth from "../locales/en/auth.json";

describe("auth password security copy", () => {
  const supabasePwnedPasswordError = {
    code: "weak_password",
    message: "Password is known to be weak and easy to guess, please choose a different one.",
    weak_password: {
      reasons: ["pwned"],
    },
  };

  it("keeps leaked-password guidance localized for any password auth surface", () => {
    expect(enAuth.auth.signup.passwordHelp).toContain("unique password");
    expect(enAuth.auth.errors.weakPasswordPwned).toContain("password manager");
    expect(arAuth.auth.signup.passwordHelp).toContain("فريدة");
    expect(arAuth.auth.errors.weakPasswordPwned).toContain("مدير كلمات المرور");
  });

  it("documents the Supabase pwned-password error shape this copy handles", () => {
    expect(supabasePwnedPasswordError.code).toBe("weak_password");
    expect(supabasePwnedPasswordError.weak_password.reasons).toContain("pwned");
  });
});
