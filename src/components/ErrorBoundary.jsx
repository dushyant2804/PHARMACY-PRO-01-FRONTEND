import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Home } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6" data-testid="error-boundary">
          <div className="bg-white border border-red-200 rounded-sm p-8 max-w-md text-center">
            <AlertTriangle className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <div className="font-heading text-xl font-bold text-slate-900">Something went wrong</div>
            <p className="text-sm text-slate-600 mt-2">
              {String(this.state.error?.message || this.state.error || "Unexpected error")}
            </p>
            <div className="flex gap-2 justify-center mt-5">
              <button
                onClick={this.reset}
                className="px-4 py-2 text-sm rounded-sm border border-slate-300 hover:bg-slate-50"
              >
                Try again
              </button>
              <Link
                to="/"
                onClick={this.reset}
                className="px-4 py-2 text-sm rounded-sm bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
              >
                <Home className="w-4 h-4" />Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
