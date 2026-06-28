interface SectionIntroProps {
  description: string;
  title: string;
}

export function SectionIntro({ description, title }: SectionIntroProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-medium text-sm">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
