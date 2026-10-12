import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/forms/Feedback";
import { firstParam, planNextPath, safeNextPath } from "@/lib/redirects";
import { getCurrentUser } from "@/lib/session";
import { AuthHeading } from "../AuthHeading";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <>
      <AuthHeading eyebrow="New line" title="Join the network" lede="One tower. One engineer. Unlimited confidence." />
      <Suspense fallback={<FormSkeleton fields={4} label="Loading registration form" />}>
        <RegisterGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RegisterGate({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const params = await searchParams;
  // A plan chosen on the pricing table rides along to the portal after sign-up.
  const next = safeNextPath(firstParam(params.next) ?? planNextPath(firstParam(params.plan)));
  if (await getCurrentUser()) redirect(next);
  return <RegisterForm next={next} />;
}
