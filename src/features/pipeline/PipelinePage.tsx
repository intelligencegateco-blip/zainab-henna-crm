import { CalendarDays, Search, Users } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Input, Select } from '../../components/ui/Field';
import { Money, PageHeader } from '../../components/ui/Misc';
import { EVENT_LABEL, LEAD_SOURCES, PIPELINE_STAGES, SOURCE_LABEL } from '../../lib/constants';
import { formatDate, formatUSD, normalize, relativeDay } from '../../lib/format';
import type { ContactView } from '../../lib/selectors';
import { usePermissions } from '../../state/AuthContext';
import { useCrmData } from '../../state/CrmContext';
import type { PipelineStage } from '../../types/models';
import { FollowUpCell } from '../leads/LeadsPage';
import { useStageMover } from './useStageMover';

export function PipelinePage() {
  const { views, data } = useCrmData();
  const mover = useStageMover();
  const { canWrite } = usePermissions();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [service, setService] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);

  const cards = useMemo(() => {
    const q = normalize(query.trim());
    return views.filter(
      (c) =>
        !c.archived &&
        (!source || c.source === source) &&
        (!service || c.serviceId === service) &&
        (!q || normalize(`${c.fullName} ${c.phone} ${c.instagram ?? ''}`).includes(q)),
    );
  }, [views, query, source, service]);

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, ContactView[]>(PIPELINE_STAGES.map((s) => [s.value, []]));
    for (const c of cards) map.get(c.stage)?.push(c);
    for (const list of map.values()) {
      list.sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
    }
    return map;
  }, [cards]);

  const openValue = cards
    .filter((c) => PIPELINE_STAGES.find((s) => s.value === c.stage)?.open)
    .reduce((s, c) => s + c.estimatedValue, 0);

  const onDrop = (e: DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverStage(null);
    if (id) void mover.move(id, stage);
  };

  return (
    <div className="page page-wide">
      <PageHeader
        title="Pipeline"
        subtitle={
          <>
            {canWrite ? 'Drag a card to move it, or use its menu. ' : ''}<strong className="num">{formatUSD(openValue)}</strong> in open inquiries.
          </>
        }
      />

      <div className="pipeline-filters">
        <div className="search">
          <Search aria-hidden />
          <Input type="search" aria-label="Search the pipeline" placeholder="Find a name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Any source" options={LEAD_SOURCES} />
        <Select
          aria-label="Service"
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Any service"
          options={data.services.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>

      <div className="kanban" role="list" aria-label="Pipeline stages">
        {PIPELINE_STAGES.map((stage, index) => {
          const list = byStage.get(stage.value) ?? [];
          const total = list.reduce((s, c) => s + c.estimatedValue, 0);
          return (
            <section
              key={stage.value}
              role="listitem"
              aria-label={`${stage.label}, ${list.length} leads`}
              className={`kanban-col stage-${stage.value} ${overStage === stage.value ? 'drop-over' : ''} ${stage.open ? '' : 'closed'}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overStage !== stage.value) setOverStage(stage.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
              }}
              onDrop={(e) => canWrite && onDrop(e, stage.value)}
            >
              <header className="kanban-head">
                <span className="kanban-step num" aria-hidden>
                  {index + 1}
                </span>
                <div>
                  <h2>{stage.label}</h2>
                  <p className="num">
                    {list.length} {list.length === 1 ? 'lead' : 'leads'}
                    {total > 0 && `, ${formatUSD(total)}`}
                  </p>
                </div>
              </header>
              <div className="kanban-cards">
                {list.length === 0 && <p className="kanban-empty">{stage.hint}</p>}
                {list.map((c) => (
                  <article
                    key={c.id}
                    className={`kanban-card ${dragId === c.id ? 'dragging' : ''}`}
                    draggable={canWrite}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', c.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(c.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    data-testid={`card-${c.id}`}
                  >
                    <div className="kanban-card-top">
                      <Link to={`/leads/${c.id}`} className="kanban-name">
                        {c.fullName}
                      </Link>
                      <Money value={c.estimatedValue} className="kanban-value" />
                    </div>
                    <p className="kanban-service">{c.serviceName ?? 'Service not chosen'}</p>
                    <dl className="kanban-meta">
                      <div>
                        <dt>
                          <CalendarDays size={13} aria-label="Event date" />
                        </dt>
                        <dd title={formatDate(c.eventDate)}>
                          {c.eventDate ? relativeDay(c.eventDate) : 'No date'}, {EVENT_LABEL[c.eventType].toLowerCase()}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <Users size={13} aria-label="Source" />
                        </dt>
                        <dd>
                          {SOURCE_LABEL[c.source]}, {c.groupSize} {c.groupSize === 1 ? 'person' : 'people'}
                        </dd>
                      </div>
                    </dl>
                    <div className="kanban-card-foot">
                      <span className="small">
                        <FollowUpCell date={c.nextFollowUpDate} />
                      </span>
                      {canWrite && <select
                        className="kanban-move"
                        aria-label={`Move ${c.fullName} to stage`}
                        value={c.stage}
                        onChange={(e) => void mover.move(c.id, e.target.value as PipelineStage)}
                      >
                        {PIPELINE_STAGES.map((s, i) => (
                          <option key={s.value} value={s.value}>
                            {i + 1}. {s.label}
                          </option>
                        ))}
                      </select>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {mover.dialogs}
    </div>
  );
}
