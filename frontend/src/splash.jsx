import React from 'react';
import ReactDOM from 'react-dom';
// eslint-disable-next-line import/extensions
import './splash.css';

ReactDOM.render(<Splash />, document.getElementById('root'));

function Splash() {
  return (
    <div>
      Loading WOW!
      Splash SCREEN!
    </div>
  );
}

export default Splash;
