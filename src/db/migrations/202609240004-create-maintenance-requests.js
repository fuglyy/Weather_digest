export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('maintenance_requests', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    equipment_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'equipment',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    title: {
      type: Sequelize.STRING(200),
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    priority: {
      type: Sequelize.STRING(20),
      allowNull: false,
    },
    status: {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'new',
    },
    planned_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    created_by: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('maintenance_requests');
}
