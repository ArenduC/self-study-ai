import React from 'react';
import { StudySuggestions } from '../services/geminiService';
import { Icon } from './Icon';

interface StudySuggestionsDisplayProps {
  references: StudySuggestions;
}

const StudySuggestionsDisplay: React.FC<StudySuggestionsDisplayProps> = ({ references }) => {
  const hasArticles = references.articles && references.articles.length > 0;
  const hasVideos = references.videos && references.videos.length > 0;
  const hasCaseStudies = references.caseStudies && references.caseStudies.length > 0;

  if (!hasArticles && !hasVideos && !hasCaseStudies) {
    return null;
  }

  return (
    <div className="mt-8 border-t dark:border-primary pt-6 space-y-8">
      <h3 className="text-xl font-semibold text-text-dark dark:text-background">Further Study Materials</h3>
      
      {hasArticles && (
        <div>
          <h4 className="text-lg font-semibold mb-3 flex items-center text-text-dark dark:text-background">
            <Icon name="link" className="w-5 h-5 mr-2" />
            Recommended Articles & Concepts
          </h4>
          <ul className="space-y-3 list-disc list-inside pl-2">
            {references.articles.map((article, index) => (
              <li key={index} className="text-sm">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">
                  {article.title}
                </a>
                <p className="text-gray-600 dark:text-primary-light ml-4 text-xs">- Key Concept: {article.concept}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasVideos && (
        <div>
          <h4 className="text-lg font-semibold mb-3 flex items-center text-text-dark dark:text-background">
            <Icon name="video" className="w-5 h-5 mr-2" />
            Suggested Videos
          </h4>
          <ul className="space-y-3 list-disc list-inside pl-2">
            {references.videos.map((video, index) => (
              <li key={index} className="text-sm">
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">
                  {video.title}
                </a>
                <p className="text-gray-600 dark:text-primary-light ml-4 text-xs">- Channel: {video.channel}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasCaseStudies && (
        <div>
          <h4 className="text-lg font-semibold mb-3 flex items-center text-text-dark dark:text-background">
            <Icon name="case" className="w-5 h-5 mr-2" />
            Related Case Studies & Examples
          </h4>
          <ul className="space-y-3 list-disc list-inside pl-2">
            {references.caseStudies.map((study, index) => (
              <li key={index} className="text-sm">
                <p className="font-medium text-text-dark dark:text-background">{study.title}</p>
                <p className="text-gray-600 dark:text-primary-light ml-4 text-xs">{study.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StudySuggestionsDisplay;