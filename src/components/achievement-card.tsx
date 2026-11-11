import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AchievementCardProps {
  title: string;
  description: string;
  url: string;
}

// Styled to match PlatformCard exactly (badge, bold headline, muted
// subtitle, link) so it reads as the same kind of card in the grid —
// see progress-tracker.md for why these can't be real sync adapters
// (CSES: no per-user API/profile at all,
// ICPC: not a personal-rating platform). Owner-curated via /admin.
export function AchievementCard({
  title,
  description,
  url,
}: AchievementCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Badge variant="secondary">featured</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {description && (
          <p className="text-2xl font-semibold">{description}</p>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="text-sm font-medium underline underline-offset-4"
          >
            View
          </a>
        )}
      </CardContent>
    </Card>
  );
}
