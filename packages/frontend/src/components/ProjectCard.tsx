import { Link } from 'react-router-dom';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
  showScore?: boolean;
}

export function ProjectCard({ project, showScore = false }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
          {project.name}
        </h3>
        {showScore && project.overallScore && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
            {project.overallScore.toFixed(1)}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-400 mb-4 line-clamp-2">{project.description}</p>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 capitalize">
          {project.category.replace(/-/g, ' ')}
        </span>
        <span>👥 {project.teamSize}</span>
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300"
            onClick={e => e.stopPropagation()}
          >
            GitHub
          </a>
        )}
      </div>
    </Link>
  );
}
