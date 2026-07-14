import * as Sentry from "@sentry/react";
import React from "react";

interface ErrorFallbackProps {
    error: Error;
    resetError: () => void;
}

const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    padding: '2rem',
    textAlign: 'center',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '0.5rem',
    border: '1px solid rgba(239, 68, 68, 0.3)',
};

const headingStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#dc2626'
};

const messageStyle: React.CSSProperties = {
    color: '#6b7280',
    marginBottom: '1.5rem',
    maxWidth: '400px'
};

const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
};

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
    <div className="error-fallback" style={containerStyle}>
        <h2 style={headingStyle}>
            Something went wrong
        </h2>
        <p style={messageStyle}>
            {error.message || 'An unexpected error occurred'}
        </p>
        <button
            type="button"
            onClick={resetError}
            style={buttonStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            onFocus={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onBlur={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
            Try again
        </button>
    </div>
);

export const ErrorBoundary = Sentry.withErrorBoundary(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
    {
        fallback: ({ error, resetError }: { error: unknown; resetError: () => void }) => {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            return (
                <ErrorFallback
                    error={{ name: 'Error', message: errorMessage }}
                    resetError={resetError}
                />
            );
        },
        showDialog: true, // Shows Sentry feedback dialog
    }
);

export default ErrorBoundary;
