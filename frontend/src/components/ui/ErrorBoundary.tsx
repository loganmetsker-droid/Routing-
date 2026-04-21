import React from 'react';
import ErrorState from './ErrorState';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  title?: string;
  message?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage?: string;
};

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Trovan UI boundary caught an error', error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.title || 'Application Error'}
          message={
            this.props.message ||
            this.state.errorMessage ||
            'The interface hit an unexpected render failure.'
          }
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
