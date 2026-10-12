import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FormSkeleton } from "@/components/forms/Feedback";
import { getCurrentUser } from "@/lib/session";
import { AuthHeading } from "../AuthHeading";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        eyebrow="Account recovery"
        title="Forgot your password?"
        lede="Enter your email and we'll send you a link to choose a new one."
      />
      <Suspense fallback={<FormSkeleton fields={1} label="Loading form" />}>
        <ForgotGate />
      </Suspense>
    </>
  );
}

async function ForgotGate() {
  if (await getCurrentUser()) redirect("/portal");
  return <ForgotPasswordForm />;
}
