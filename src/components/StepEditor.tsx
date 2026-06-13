import type { ProgressStep } from "../domain/task";

type StepEditorProps = {
  steps: ProgressStep[];
  onChange: (steps: ProgressStep[]) => void;
};

export function StepEditor({ steps, onChange }: StepEditorProps) {
  function updateStep(id: string, patch: Partial<ProgressStep>) {
    onChange(
      steps.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
      ),
    );
  }

  function deleteStep(id: string) {
    onChange(steps.filter((s) => s.id !== id));
  }

  function addStep() {
    const newStep: ProgressStep = {
      id: `step_${Date.now()}`,
      text: "",
      completed: false,
      updatedAt: new Date().toISOString(),
    };
    onChange([...steps, newStep]);
  }

  return (
    <section className="step-editor">
      <h2>步骤</h2>
      <ul className="step-list">
        {steps.map((step) => (
          <li key={step.id} className="step-row">
            <input
              type="checkbox"
              checked={step.completed}
              onChange={(e) => updateStep(step.id, { completed: e.target.checked })}
              aria-label="切换步骤完成状态"
            />
            <input
              type="text"
              className="step-text-input"
              value={step.text}
              onChange={(e) => updateStep(step.id, { text: e.target.value })}
              placeholder="输入步骤..."
              aria-label="步骤文本"
            />
            <button
              type="button"
              className="step-delete-button"
              onClick={() => deleteStep(step.id)}
              aria-label="删除步骤"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="step-add-button" onClick={addStep}>
        + 添加步骤
      </button>
    </section>
  );
}
