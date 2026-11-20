import { Card, EmptyState, PageHeader } from '../components/common/UI'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="placeholder-grid">
        <Card className="placeholder-card">
          <EmptyState
            title="Ready for Phase 3"
            description="This page is included in the foundation and will be connected to the API and simulation engine later."
          />
        </Card>
      </div>
    </>
  )
}
