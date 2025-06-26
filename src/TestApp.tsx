import React from 'react';
import { UserInterface } from './types/chat-new';

function TestApp() {
  console.log('TestApp loading...');
  console.log('UserInterface imported successfully');
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Test App</h1>
      <p>If you can see this, React is working!</p>
      <p>UserInterface import test: OK</p>
    </div>
  );
}

export default TestApp;