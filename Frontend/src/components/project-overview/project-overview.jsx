<>
  <ProjectFigure project={project} />

  <div className="overview-container">

    <ProjectStats project={project} />

    <div className="overview-grid">
      <ProjectMembers members={members} />
      <RecentActivity activities={activities} />
    </div>

    <ProjectMilestones milestones={milestones} />

  </div>
</>
