CREATE EXTENSION hstore;

CREATE TABLE IF NOT EXISTS directories (
	id 			varchar(64) PRIMARY KEY,
	name		varchar(64) NOT NULL,
	owner		varchar(255) NOT NULL,
	created_at	timestamp WITH TIME ZONE DEFAULT NOW(),
	updated_at	timestamp WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS links (
	id 			serial PRIMARY KEY,
	dir_id		varchar(64) REFERENCES directories (id) ON DELETE CASCADE,
	href        varchar(255),
	title       varchar(255),
	rel         text[],
	meta        json,
	created_at	timestamp WITH TIME ZONE DEFAULT NOW(),
	updated_at	timestamp WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON TABLE directories TO machine;
GRANT ALL PRIVILEGES ON TABLE links TO machine;
GRANT ALL PRIVILEGES ON SEQUENCE links_id_seq TO machine;