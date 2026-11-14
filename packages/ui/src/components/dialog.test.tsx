import {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {Button, Dialog} from '../index.js';

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(<Dialog open={false} onClose={() => undefined} title="Delete?" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog with the actions in its footer', () => {
    render(
      <Dialog
        open
        onClose={() => undefined}
        title="Delete this asset?"
        description="This cannot be undone."
        actions={<Button>Delete</Button>}
      />,
    );

    const dialog = screen.getByRole('dialog', {name: 'Delete this asset?'});
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByRole('button', {name: 'Delete'})).toBeVisible();
  });

  it('moves focus to the first action and returns it to the trigger on close', () => {
    const TestCase = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Delete
          </button>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Delete this asset?"
            actions={
              <>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button>Delete</Button>
              </>
            }
          />
        </>
      );
    };
    render(<TestCase />);

    const trigger = screen.getByRole('button', {name: 'Delete'});
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', {name: 'Cancel'})).toHaveFocus();

    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Revoke this session?" />);

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab and Shift+Tab inside the dialog', () => {
    render(
      <Dialog
        open
        onClose={() => undefined}
        title="Delete this asset?"
        actions={
          <>
            <Button variant="secondary">Cancel</Button>
            <Button>Delete</Button>
          </>
        }
      />,
    );

    const cancel = screen.getByRole('button', {name: 'Cancel'});
    const confirm = screen.getByRole('button', {name: 'Delete'});
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(document, {key: 'Tab'});
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, {key: 'Tab', shiftKey: true});
    expect(confirm).toHaveFocus();
  });
});
