import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaRedo, FaTimes } from 'react-icons/fa';
import mermaid from 'mermaid';
import './DiagramPlayer.css';

const DiagramPlayer = ({ code, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState([]);
  const [explanations, setExplanations] = useState([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // Pre-render all diagrams for each step
  const preRenderDiagrams = async (steps) => {
    const renderedSteps = [];

    // Initialize mermaid once
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      logLevel: 'fatal',
      securityLevel: 'loose'
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        // Create a unique ID for this diagram
        const id = `mermaid-prerender-${i}-${Math.random().toString(36).substring(2)}`;

        // Ensure the diagram code is properly formatted
        let finalCode = step.code.trim();
        if (!finalCode.startsWith('sequenceDiagram')) {
          finalCode = 'sequenceDiagram\n' + finalCode;
        }

        console.log('Rendering diagram with code:', finalCode);

        // Render the diagram with the processed code
        const { svg } = await mermaid.render(id, finalCode);

        // Add the rendered SVG to the step
        renderedSteps.push({
          ...step,
          svg
        });

        console.log(`Pre-rendered step ${i+1}/${steps.length}`);
      } catch (error) {
        console.error(`Failed to pre-render step ${i+1}:`, error);
        renderedSteps.push({
          ...step,
          svg: `<div class="error">Rendering error: ${error.message}</div>`
        });
      }
    }

    return renderedSteps;
  };

  // Parse the diagram code into steps
  useEffect(() => {
    if (!code) return;

    console.log('Parsing diagram code:', code);

    // Make sure the code starts with sequenceDiagram
    let diagramCode = code.trim();
    if (!diagramCode.startsWith('sequenceDiagram')) {
      diagramCode = 'sequenceDiagram\n' + diagramCode;
    }

    // Split the code into lines
    const lines = diagramCode.split('\n');

    // Filter out empty lines and comments
    const filteredLines = lines.filter(line =>
      line.trim() !== '' && !line.trim().startsWith('%%'));

    // Extract participant lines for the base diagram
    const participantLines = filteredLines.filter(line =>
      line.trim().startsWith('participant') || line.trim().startsWith('actor'));

    // Start with a basic sequence diagram including all participants
    let baseCode = 'sequenceDiagram';
    if (participantLines.length > 0) {
      baseCode += '\n' + participantLines.join('\n');
    }

    // Create steps array
    const newSteps = [];

    // First step is just the diagram with participants
    newSteps.push({
      code: baseCode,
      explanation: 'Diagram setup with participants'
    });

    // Get all non-participant, non-sequenceDiagram lines
    const contentLines = filteredLines.filter(line =>
      !line.trim().startsWith('sequenceDiagram') &&
      !line.trim().startsWith('participant') &&
      !line.trim().startsWith('actor'));

    // Start building from the base code
    let currentCode = baseCode;

    // Process the content lines, handling blocks properly
    let i = 0;
    while (i < contentLines.length) {
      const line = contentLines[i];
      const trimmedLine = line.trim();

      // Check if this line starts a block (loop, alt, opt, critical, break, par, rect, etc.)
      if (trimmedLine.startsWith('loop') ||
          trimmedLine.startsWith('alt') ||
          trimmedLine.startsWith('opt') ||
          trimmedLine.startsWith('par') ||
          trimmedLine.startsWith('rect') ||
          trimmedLine.startsWith('critical') ||
          trimmedLine.startsWith('break') ||
          trimmedLine.startsWith('box')) {

        // Find the matching 'end' for this block
        let blockDepth = 1;
        let blockEndIndex = i;
        let blockLines = [line];

        // Search for the matching end, accounting for nested blocks
        for (let j = i + 1; j < contentLines.length; j++) {
          const nextLine = contentLines[j];
          const nextTrimmed = nextLine.trim();

          blockLines.push(nextLine);

          if (nextTrimmed.startsWith('loop') ||
              nextTrimmed.startsWith('alt') ||
              nextTrimmed.startsWith('opt') ||
              nextTrimmed.startsWith('par') ||
              nextTrimmed.startsWith('rect') ||
              nextTrimmed.startsWith('critical') ||
              nextTrimmed.startsWith('break') ||
              nextTrimmed.startsWith('box')) {
            blockDepth++;
          } else if (nextTrimmed === 'end') {
            blockDepth--;
            if (blockDepth === 0) {
              blockEndIndex = j;
              break;
            }
          }
        }

        // Add the entire block as one step
        const blockCode = blockLines.join('\n');

        // No need to process participants - let Mermaid handle it

        currentCode += '\n' + blockCode;

        // Create explanation based on the block type
        let explanation = 'Processing a block of interactions';
        if (trimmedLine.startsWith('loop')) {
          explanation = `Loop: ${trimmedLine.replace('loop', '').trim()}`;
        } else if (trimmedLine.startsWith('alt')) {
          explanation = `Alternative path: ${trimmedLine.replace('alt', '').trim()}`;
        } else if (trimmedLine.startsWith('opt')) {
          explanation = `Optional path: ${trimmedLine.replace('opt', '').trim()}`;
        } else if (trimmedLine.startsWith('par')) {
          explanation = `Parallel execution: ${trimmedLine.replace('par', '').trim()}`;
        } else if (trimmedLine.startsWith('rect')) {
          explanation = `Group with background: ${trimmedLine.replace('rect', '').trim()}`;
        } else if (trimmedLine.startsWith('critical')) {
          explanation = `Critical section: ${trimmedLine.replace('critical', '').trim()}`;
        } else if (trimmedLine.startsWith('break')) {
          explanation = `Break condition: ${trimmedLine.replace('break', '').trim()}`;
        } else if (trimmedLine.startsWith('box')) {
          explanation = `Actor grouping: ${trimmedLine.replace('box', '').trim()}`;
        }

        newSteps.push({
          code: currentCode,
          explanation
        });

        // Skip to after the end of the block
        i = blockEndIndex + 1;
      }
      // Handle regular lines (not part of a block)
      else {
        currentCode += '\n' + line;

        let explanation = 'Diagram updated';

        // Try to generate a meaningful explanation
        if (trimmedLine.includes('->') || trimmedLine.includes('->>')) {
          // It's a message
          const parts = trimmedLine.split(':');
          const interaction = parts[0].trim();
          const message = parts.length > 1 ? parts[1].trim() : '';

          // Extract sender and receiver
          let [sender, receiver] = ['', ''];
          if (interaction.includes('->')) {
            [sender, receiver] = interaction.split('->');
          } else if (interaction.includes('->>')) {
            [sender, receiver] = interaction.split('->>');
          }

          sender = sender.trim();
          receiver = receiver.trim();

          explanation = `${sender} sends "${message}" to ${receiver}`;
        }
        else if (trimmedLine.startsWith('Note')) {
          // It's a note
          const parts = trimmedLine.split(':');
          const noteContent = parts.length > 1 ? parts[1].trim() : '';
          explanation = `Note: ${noteContent}`;
        }
        // We don't need to handle 'end' here as it's handled in the block processing

        newSteps.push({
          code: currentCode,
          explanation
        });

        i++;
      }
    }

    // Pre-render all diagrams
    console.log('Pre-rendering diagrams for', newSteps.length, 'steps');
    setIsLoading(true);
    preRenderDiagrams(newSteps).then(renderedSteps => {
      console.log('All diagrams pre-rendered');
      setSteps(renderedSteps);
      setTotalSteps(renderedSteps.length);
      setCurrentStep(0);

      // Extract just the explanations
      const newExplanations = renderedSteps.map(step => step.explanation);
      setExplanations(newExplanations);
      setIsLoading(false);
    });

  }, [code]);

  // Handle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Move to next step
  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Reached the end, stop playing
      setIsPlaying(false);
    }
  };

  // Move to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Reset to beginning
  const reset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  // Auto-advance when playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setTimeout(() => {
        nextStep();
      }, 2000); // Advance every 2 seconds
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentStep]);

  // Render the current step using pre-rendered SVG
  useEffect(() => {
    if (steps.length === 0 || !playerRef.current) return;

    const currentStepData = steps[currentStep];
    if (!currentStepData) return;

    try {
      // Clear previous diagram
      playerRef.current.innerHTML = '';

      console.log('Displaying pre-rendered SVG for step', currentStep);

      // If we have a pre-rendered SVG, use it
      if (currentStepData.svg) {
        // Create a container for the SVG
        const svgContainer = document.createElement('div');
        svgContainer.innerHTML = currentStepData.svg;

        // Get the SVG element
        const svgElement = svgContainer.querySelector('svg');

        if (svgElement) {
          // Make sure SVG is visible
          svgElement.setAttribute('width', '100%');
          svgElement.setAttribute('height', 'auto');
          svgElement.style.maxHeight = '500px';
          svgElement.style.display = 'block';
          svgElement.style.margin = '0 auto';

          playerRef.current.appendChild(svgElement);
          console.log('Pre-rendered SVG element displayed');
        } else {
          // If no SVG element found, just use the raw HTML
          playerRef.current.innerHTML = currentStepData.svg;
          console.log('Using raw SVG HTML');
        }
      } else {
        // Fallback to rendering on the fly
        console.log('No pre-rendered SVG, rendering on the fly');

        // Create a unique ID for this diagram instance
        const id = `mermaid-player-${Math.random().toString(36).substring(2)}`;

        // Create a temporary container
        const tempContainer = document.createElement('div');
        tempContainer.id = id;
        playerRef.current.appendChild(tempContainer);

        // Initialize mermaid for this render
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          logLevel: 'fatal',
          securityLevel: 'loose'
        });

        // Ensure the diagram code is properly formatted
        let finalCode = currentStepData.code.trim();
        if (!finalCode.startsWith('sequenceDiagram')) {
          finalCode = 'sequenceDiagram\n' + finalCode;
        }

        console.log('Rendering diagram with code:', finalCode);

        // Render the diagram for the current step
        mermaid.render(id, finalCode).then(({ svg }) => {
          tempContainer.innerHTML = svg;
        }).catch(error => {
          console.error('Error rendering step:', error);
          tempContainer.innerHTML = `<div class="error">Rendering error: ${error.message}</div>`;
        });
      }
    } catch (error) {
      console.error('Error in diagram player:', error);
      if (playerRef.current) {
        playerRef.current.innerHTML = `<div class="error">Error displaying diagram: ${error.message}</div>`;
      }
    }
  }, [currentStep, steps]);

  // Enter fullscreen mode when component mounts
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && document.fullscreenEnabled) {
          await containerRef.current.requestFullscreen();
        }
      } catch (error) {
        console.error('Failed to enter fullscreen mode:', error);
      }
    };

    enterFullscreen();

    // Exit fullscreen when component unmounts
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.error('Error exiting fullscreen:', err);
        });
      }
    };
  }, []);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // User exited fullscreen (e.g., by pressing Esc)
        // Wait a moment before closing to ensure clean exit
        setTimeout(() => {
          onClose();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onClose]);

  // Handle close button click
  const handleClose = async () => {
    try {
      // First exit fullscreen if we're in fullscreen mode
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      // Wait a moment to ensure fullscreen has exited
      setTimeout(() => {
        // Then call the onClose callback
        onClose();
      }, 100);
    } catch (err) {
      console.error('Error exiting fullscreen:', err);
      onClose();
    }
  };

  return (
    <div className="diagram-player-container" ref={containerRef}>
      <button className="close-player-button" onClick={handleClose} title="Exit presentation mode">
        <FaTimes />
      </button>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Preparing presentation...</p>
        </div>
      ) : (
        <>
          <div className="diagram-player-controls">
        <button onClick={reset} title="Reset to beginning">
          <FaRedo />
        </button>
        <button onClick={prevStep} disabled={currentStep === 0} title="Previous Step">
          <FaStepBackward />
        </button>
        <button onClick={togglePlay} title={isPlaying ? "Pause animation" : "Play animation"}>
          {isPlaying ? <FaPause /> : <FaPlay />}
        </button>
        <button onClick={nextStep} disabled={currentStep === totalSteps - 1} title="Next Step">
          <FaStepForward />
        </button>
        <span className="step-counter">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <div className="presentation-title">Sequence Diagram Presentation</div>
      </div>

      <div className="diagram-player-view" ref={playerRef}></div>

      <div className="diagram-player-explanation">
        <h3>Explanation:</h3>
        <p>{explanations[currentStep]}</p>
      </div>
        </>
      )}
    </div>
  );
};

export default DiagramPlayer;
