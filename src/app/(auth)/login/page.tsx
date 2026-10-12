import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/forms/Feedback";
import { firstParam, safeNextPath } from "@/lib/redirects";
import { getCurrentUser } from "@/lib/session";
import { AuthHeading } from "../AuthHeading";
import { LoginForm, type LoginNotice } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <AuthHeading eyebrow="Portal access" title="Sign in" lede="Sign in to access the network." />
      <Suspense fallback={<FormSkeleton fields={2} label="Loading sign-in form" />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  if (await getCurrentUser()) redirect(next);
  return <LoginForm next={next} notice={noticeFor(params)} />;
}

function noticeFor(params: Record<string, string | string[] | undefined>): LoginNotice | null {
  if (firstParam(params.reset) === "1") {
    return { variant: "success", text: "Password updated. Sign in with your new password. You've been signed out on every other device." };
  }
  if (firstParam(params.signedout) === "1") {
    return { variant: "info", text: "You've been signed out. The network will try not to take it personally." };
  }
  return null;
}
