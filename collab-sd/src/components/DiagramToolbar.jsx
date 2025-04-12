import React from 'react';
import './DiagramToolbar.css';
import { 
  FaUser, 
  FaUserTie, 
  FaStickyNote, 
  FaObjectGroup, 
  FaRedo, 
  FaCodeBranch, 
  FaLayerGroup, 
  FaQuestionCircle, 
  FaLock, 
  FaStop 
} from 'react-icons/fa';

const DiagramToolbar = ({ onInsertCode }) => {
  const toolbarItems = [
    {
      label: 'Participant',
      icon: <FaUser />,
      code: 'participant Name\n',
      description: 'Add a new participant'
    },
    {
      label: 'Actor',
      icon: <FaUserTie />,
      code: 'actor Name\n',
      description: 'Add a new actor'
    },
    {
      label: 'Note',
      icon: <FaStickyNote />,
      code: 'Note over Name: Note text\n',
      description: 'Add a note over a participant'
    },
    {
      label: 'Group',
      icon: <FaObjectGroup />,
      code: 'rect rgb(200, 220, 240)\n    Note over A,B: Group Name\n    A->>B: Message\nend\n',
      description: 'Add a group of messages'
    },
    {
      label: 'Loop',
      icon: <FaRedo />,
      code: 'loop Loop Name\n    A->>B: Message\nend\n',
      description: 'Add a loop block'
    },
    {
      label: 'Alt',
      icon: <FaCodeBranch />,
      code: 'alt Alternative 1\n    A->>B: Message 1\nelse Alternative 2\n    A->>B: Message 2\nend\n',
      description: 'Add an alternative block'
    },
    {
      label: 'Parallel',
      icon: <FaLayerGroup />,
      code: 'par Parallel 1\n    A->>B: Message 1\nand Parallel 2\n    C->>D: Message 2\nend\n',
      description: 'Add parallel blocks'
    },
    {
      label: 'Opt',
      icon: <FaQuestionCircle />,
      code: 'opt Optional\n    A->>B: Message\nend\n',
      description: 'Add an optional block'
    },
    {
      label: 'Critical',
      icon: <FaLock />,
      code: 'critical Critical Section\n    A->>B: Message\nend\n',
      description: 'Add a critical section'
    },
    {
      label: 'Break',
      icon: <FaStop />,
      code: 'break Break Condition\n    A->>B: Message\nend\n',
      description: 'Add a break block'
    }
  ];

  return (
    <div className="diagram-toolbar">
      {toolbarItems.map((item, index) => (
        <button
          key={index}
          className="toolbar-button"
          onClick={() => onInsertCode(item.code)}
          title={item.description}
        >
          <span className="toolbar-icon">{item.icon}</span>
          <span className="toolbar-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DiagramToolbar; 