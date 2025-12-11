import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import App from '../App';

// Mock server to intercept API requests
const server = setupServer(
  // GET /api/items handler
  rest.get('/api/items', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'Test Item 1', created_at: '2023-01-01T00:00:00.000Z' },
        { id: 2, name: 'Test Item 2', created_at: '2023-01-02T00:00:00.000Z' },
      ])
    );
  }),
  
  // POST /api/items handler
  rest.post('/api/items', (req, res, ctx) => {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Item name is required' })
      );
    }
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 3,
        name,
        created_at: new Date().toISOString(),
      })
    );
  }),

  // DELETE /api/items/:id handler
  rest.delete('/api/items/:id', (req, res, ctx) => {
    const { id } = req.params;
    
    if (id === '999') {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Item not found' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({ message: 'Item deleted successfully' })
    );
  }),

  // PUT /api/items/:id handler
  rest.put('/api/items/:id', (req, res, ctx) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (id === '999') {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Item not found' })
      );
    }
    
    if (!name || name.trim() === '') {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Item name is required' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        id: parseInt(id),
        name,
        created_at: '2023-01-01T00:00:00.000Z',
      })
    );
  })
);

// Setup and teardown for the mock server
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('App Component', () => {
  test('renders the header', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('Connected to in-memory database')).toBeInTheDocument();
  });

  test('loads and displays items', async () => {
    await act(async () => {
      render(<App />);
    });
    
    // Initially shows loading state
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    });
  });

  test('adds a new item', async () => {
    const user = userEvent.setup();
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
    });
    
    // Fill in the form and submit
    const input = screen.getByPlaceholderText('Enter item name');
    await act(async () => {
      await user.type(input, 'New Test Item');
    });
    
    const submitButton = screen.getByText('Add Item');
    await act(async () => {
      await user.click(submitButton);
    });
    
    // Check that the new item appears
    await waitFor(() => {
      expect(screen.getByText('New Test Item')).toBeInTheDocument();
    });
  });

  test('handles API error', async () => {
    // Override the default handler to simulate an error
    server.use(
      rest.get('/api/items', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch data/)).toBeInTheDocument();
    });
  });

  test('shows empty state when no items', async () => {
    // Override the default handler to return empty array
    server.use(
      rest.get('/api/items', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json([]));
      })
    );
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for empty state message
    await waitFor(() => {
      expect(screen.getByText('No items found. Add some!')).toBeInTheDocument();
    });
  });

  test('deletes an item', async () => {
    const user = userEvent.setup();
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
    
    // Click delete button for the first item
    const deleteButtons = screen.getAllByText('Delete');
    await act(async () => {
      await user.click(deleteButtons[0]);
    });
    
    // Check that the item is removed
    await waitFor(() => {
      expect(screen.queryByText('Test Item 1')).not.toBeInTheDocument();
    });
  });

  test('handles delete error', async () => {
    const user = userEvent.setup();
    
    // Override the handler to simulate an error
    server.use(
      rest.delete('/api/items/:id', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Failed to delete' }));
      })
    );
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
    
    // Click delete button
    const deleteButtons = screen.getAllByText('Delete');
    await act(async () => {
      await user.click(deleteButtons[0]);
    });
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/Error deleting item/)).toBeInTheDocument();
    });
  });

  test('enters edit mode when Edit button is clicked', async () => {
    const user = userEvent.setup();
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
    
    // Click edit button for the first item
    const editButtons = screen.getAllByText('Edit');
    await act(async () => {
      await user.click(editButtons[0]);
    });
    
    // Check that Save and Cancel buttons appear
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    // Check that input field is present with the item's name
    const editInput = screen.getByDisplayValue('Test Item 1');
    expect(editInput).toBeInTheDocument();
  });

  test('updates an item successfully', async () => {
    const user = userEvent.setup();
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
    
    // Click edit button
    const editButtons = screen.getAllByText('Edit');
    await act(async () => {
      await user.click(editButtons[0]);
    });
    
    // Wait for edit mode
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
    
    // Change the input value
    const editInput = screen.getByDisplayValue('Test Item 1');
    await act(async () => {
      await user.clear(editInput);
      await user.type(editInput, 'Updated Item Name');
    });
    
    // Click save button
    const saveButton = screen.getByText('Save');
    await act(async () => {
      await user.click(saveButton);
    });
    
    // Check that the item is updated
    await waitFor(() => {
      expect(screen.getByText('Updated Item Name')).toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });
  });

  test('cancels edit mode', async () => {
    const user = userEvent.setup();
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
    
    // Click edit button
    const editButtons = screen.getAllByText('Edit');
    await act(async () => {
      await user.click(editButtons[0]);
    });
    
    // Wait for edit mode
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    // Click cancel button
    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
      await user.click(cancelButton);
    });
    
    // Check that edit mode is exited
    await waitFor(() => {
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
  });

  test('handles update error', async () => {
    const user = userEvent.setup();
    
    // Override the handler to simulate an error
    server.use(
      rest.put('/api/items/:id', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Failed to update' }));
      })
    );
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    });
    
    // Click edit button
    const editButtons = screen.getAllByText('Edit');
    await act(async () => {
      await user.click(editButtons[0]);
    });
    
    // Wait for edit mode
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
    
    // Change the input value
    const editInput = screen.getByDisplayValue('Test Item 1');
    await act(async () => {
      await user.clear(editInput);
      await user.type(editInput, 'Updated Item Name');
    });
    
    // Click save button
    const saveButton = screen.getByText('Save');
    await act(async () => {
      await user.click(saveButton);
    });
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/Error updating item/)).toBeInTheDocument();
    });
  });

  test('prevents adding empty item', async () => {
    const user = userEvent.setup();
    
    await act(async () => {
      render(<App />);
    });
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
    });
    
    // Try to submit with empty input
    const submitButton = screen.getByText('Add Item');
    await act(async () => {
      await user.click(submitButton);
    });
    
    // Should not add anything (no new item with empty name)
    expect(screen.queryByText('')).not.toBeInTheDocument();
  });
});