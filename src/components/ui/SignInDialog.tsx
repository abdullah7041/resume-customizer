import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, type AuthEntrySource } from "@/hooks/useAuth";
import { Button } from "@/components/ui/shadcn/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/shadcn/dialog";

interface SignInProps {
  source: AuthEntrySource;
  onStart?: () => void;
}

export function SignInOptions({ source, onStart }: SignInProps) {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithLinkedIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async (signIn: typeof signInWithGoogle) => {
    setPending(true);
    setFailed(false);
    try {
      onStart?.();
      if (await signIn({ intent: "signin", source })) return;
    } catch (error) {
      console.error("[SignInOptions] Could not start sign-in:", error);
    } finally {
      setPending(false);
    }
    setFailed(true);
  };

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => void start(signInWithGoogle)}>
        {t("common.continueWithGoogle", "Continue with Google")}
      </Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => void start(signInWithLinkedIn)}>
        {t("common.continueWithLinkedIn", "Continue with LinkedIn")}
      </Button>
      {failed && (
        <p role="alert" className="text-sm">
          {t("common.signInFailed", "Sign-in could not start. Try again or choose another option.")}
        </p>
      )}
    </div>
  );
}

export function SignInDialog({ children, ...props }: SignInProps & { children: ReactElement }) {
  const { t, i18n } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        dir={i18n.dir()}
        className="sm:max-w-sm"
        aria-describedby={undefined}
        showCloseButton
        closeLabel={t("common.close")}
      >
        <DialogTitle className="pr-8">{t("common.signIn")}</DialogTitle>
        <SignInOptions {...props} />
      </DialogContent>
    </Dialog>
  );
}
