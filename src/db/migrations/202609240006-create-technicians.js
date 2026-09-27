export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('technicians', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    full_name: {
      type: Sequelize.STRING(150),
      allowNull: false,
    },
    specialization: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    personnel_number: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('technicians');
}
