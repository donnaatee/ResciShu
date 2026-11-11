import { useQuery } from "@tanstack/react-query";
import { ChefHat } from "lucide-react";
import { photoUrlQuery } from "@/lib/api";
import { cn } from "@/lib/utils";

export function RecipePhoto({ path, className }: { path: string | null; className?: string }) {
  const { data } = useQuery({ ...photoUrlQuery(path ?? ""), enabled: !!path });
  if (!path || !data) return <div className={cn("grid place-items-center bg-warm text-primary/50", className)}><ChefHat className="size-10" /></div>;
  return <img src={data} alt="" className={cn("object-cover", className)} />;
}
