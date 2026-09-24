import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

/** Catches render crashes so one bad deck can't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="deck-view">
        <p className="form-error" role="alert">
          Something went wrong showing this view: {this.state.error.message}
        </p>
        <button type="button" className="button-primary retry" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
