export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('sites', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING(150),
      allowNull: false,
    },
    code: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    },
    region: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    lat: {
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
    lon: {
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('sites');
}
