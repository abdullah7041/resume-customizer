import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import TemplateRenderer from '@/components/templates/TemplateRenderer';

const templateIds = ['modern-professional', 'technical-engineer', 'ats-optimized', 'executive-professional'];

afterEach(cleanup);

it.each(templateIds)('%s offers recovery for a saved resume without basics', id => {
  render(<TemplateRenderer template={{ id, structure: {} }} userData={{ work: [] }} />);
  expect(screen.getByRole('status')).toHaveTextContent(/upload/i);
});

it.each(templateIds)('%s renders a valid resume without profiles', id => {
  render(<TemplateRenderer template={{ id, structure: {} }} userData={{ basics: { name: 'Replacement QA', label: 'Senior Data Analyst' } }} />);
  expect(screen.getByText('Replacement QA')).toBeVisible();
  expect(screen.getByText('Senior Data Analyst')).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
