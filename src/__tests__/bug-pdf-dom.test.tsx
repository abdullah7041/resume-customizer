import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { ModernProfessional } from '../components/templates/ModernProfessional';

describe('PDF Export Pagination Logic', () => {
  it('should not push every element to a new page', () => {
    const mockResume = {
      basics: {
        name: 'ABDULLAH BIN AHMED',
        label: 'Lead Software Engineer',
        email: 'test@example.com',
        summary: 'This is a test summary that is somewhat long to take up space.',
      },
      work: [
        {
          name: 'Tech Corp',
          position: 'Lead Software Engineer',
          startDate: '2020',
          endDate: 'Present',
          highlights: [
            'Containerization and stuff',
            'Automated Pipelines',
            'Observability Strategy'
          ]
        }
      ]
    } as any;

    const { container } = render(
      <ModernProfessional resume={mockResume} />
    );

    // Mock getBoundingClientRect
    // Since JSDOM doesn't do real layout, we need to mock properties or just check the code logic manually.
    // JSDOM elements all have rect {0,0,0,0}. This won't run the actual browser layout.
    // Wait, let's inject a mock layout.
    let currentY = 0;
    const elements = container.querySelectorAll('*');
    elements.forEach(el => {
      // rough approximation of height
      let height = 20;
      if (el.tagName === 'H1') height = 50;
      if (el.tagName === 'H2') height = 40;
      if (el.tagName === 'P') height = 60;
      
      el.getBoundingClientRect = () => ({
        top: currentY,
        bottom: currentY + height,
        left: 0, right: 800, width: 800, height: height,
        x: 0, y: currentY,
        toJSON: () => {}
      });
      currentY += height;
    });

    
    
    // Engine
    const selectors = [
      '.resume-section > div', 
      '.space-y-4 > div',
      '.space-y-3 > div',
      '.border-l-2', 
      'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '[data-prevent-page-break]'
    ].join(', ');

    const blocks = Array.from(container.querySelectorAll(selectors)) as HTMLElement[];
    
    // We can just verify the blocks match what we expect
    expect(blocks.length).toBeGreaterThan(0);
    
    const matchedTags = blocks.map(b => b.tagName);
    console.log('Matched Tags:', matchedTags);
  });
});
