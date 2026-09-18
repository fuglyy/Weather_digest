function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryRepository(initial = []) {
  let records = clone(initial);
  return {
    async findAll() { return clone(records); },
    async findById(id) { return clone(records.find((record) => record.id === id) || null); },
    async create(record) { records.push(clone(record)); return clone(record); },
    async update(id, changes) {
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) return null;
      records[index] = { ...records[index], ...clone(changes) };
      return clone(records[index]);
    },
    async remove(id) { const oldLength = records.length; records = records.filter((record) => record.id !== id); return records.length !== oldLength; },
  };
}