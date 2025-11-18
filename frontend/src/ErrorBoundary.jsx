import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Guardar información adicional si se necesita
    this.setState({ error, info });
    // También loguear en consola para facilitar debugging
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary capturó un error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const mensaje = this.state.error && this.state.error.toString ? this.state.error.toString() : 'Error desconocido';
      const stack = this.state.info && this.state.info.componentStack ? this.state.info.componentStack : '';
      return (
        <div style={{ padding: 24, color: '#fff', background: '#3b2f2f', minHeight: '100vh' }}>
          <h2 style={{ color: '#ff6b6b' }}>Se produjo un error en la aplicación</h2>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{mensaje}</div>
          {stack && (
            <details style={{ marginTop: 12, color: '#ddd' }}>
              <summary>Detalles (stack)</summary>
              <pre style={{ color: '#ddd' }}>{stack}</pre>
            </details>
          )}
          <div style={{ marginTop: 16 }}>
            Intenta abrir la consola del navegador (F12) y copia el error aquí para que pueda ayudarte.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
