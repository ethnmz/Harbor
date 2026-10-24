import { redirect } from "next/navigation";

export default function TemplatesPage() {
  redirect("/agents?view=templates");
}
