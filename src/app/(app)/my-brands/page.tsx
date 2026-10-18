import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { BrandTargetCard } from "@/components/BrandTargetCard";
import { getMyTargetBrands } from "@/lib/queries";
import { currentMonthKey, monthKeyLabel } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

export default async function MyBrandsPage() {
  const user = await requireUser();
  if (user.cohortIds.length === 0) redirect("/");

  const monthKey = currentMonthKey();
  const { brands, ips, cellMap, multiCohort } = await getMyTargetBrands(user.cohortIds, monthKey);

  return (
    <div>
      <PageHeader
        title="My Brands"
        subtitle={`${monthKeyLabel(monthKey, "long")} · tap a brand to set its target and update progress per IP`}
      />
      {brands.map((brand) => (
        <BrandTargetCard
          key={brand.id}
          monthKey={monthKey}
          brandId={brand.id}
          brandName={brand.name}
          subtitle={multiCohort ? brand.cohortCode : undefined}
          ips={ips}
          cellMap={cellMap}
        />
      ))}
      {brands.length === 0 && (
        <div className="text-[11px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
          No brands in your cohort yet.
        </div>
      )}
    </div>
  );
}
