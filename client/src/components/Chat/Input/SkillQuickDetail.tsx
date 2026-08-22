import type { TSkill } from 'librechat-data-provider';
import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { getSkillMetadata, skillMetadataLabels } from '~/components/Skills/display/SkillDetail';
import { parseFrontmatter } from '~/components/Skills/utils';

type SkillQuickDetailProps = {
  skill: TSkill;
  onUse: () => void;
  onOpenDetails: () => void;
  onClose?: () => void;
};

/** Compact, read-only preview used from the chat composer. */
export default function SkillQuickDetail({
  skill,
  onUse,
  onOpenDetails,
  onClose,
}: SkillQuickDetailProps) {
  const localize = useLocalize();
  const { fields } = parseFrontmatter(skill.body ?? '', new Set(['name', 'description']));
  const metadata = getSkillMetadata(fields);

  return (
    <section aria-label={skill.name} className="flex max-h-[min(32rem,70vh)] flex-col gap-3 overflow-y-auto p-4">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">{skill.displayTitle ?? skill.name}</h2>
        <p className="text-sm text-text-secondary">{skill.description}</p>
      </header>
      {metadata.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          {metadata.map(({ key, value }) => (
            <div key={key} className="contents">
              <dt className="text-text-secondary">{localize(skillMetadataLabels[key])}</dt>
              <dd className="whitespace-pre-wrap text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onUse}>{localize('com_ui_skill_use_this')}</Button>
        <Button variant="outline" onClick={onOpenDetails}>{localize('com_ui_skill_open_details')}</Button>
        {onClose && <Button variant="ghost" onClick={onClose}>{localize('com_ui_cancel')}</Button>}
      </div>
    </section>
  );
}
