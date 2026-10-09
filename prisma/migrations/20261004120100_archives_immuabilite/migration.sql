/*
  Immuabilité des archives, garantie PAR LA BASE (en plus du code applicatif).

  Pourquoi en base : le code peut avoir un bug, un script de maintenance ou une
  console SQL peut être lancé à la main. Ces triggers rendent impossible, quoi
  qu'il arrive côté application :
    - de supprimer un document, une annulation ou une ligne du journal de
      téléchargements ;
    - de modifier une annulation ou une ligne du journal ;
    - de modifier un document, SAUF pour passer son statut de ACTIF à ANNULE
      (toutes les autres colonnes doivent rester strictement identiques).
  Un document annulé ne peut donc pas être « réactivé ».

  Échappatoire volontaire et explicite (nettoyage des données de test avant
  mise en ligne, purge légale) : dans UNE transaction,
      BEGIN;
      SET LOCAL scoly.autoriser_purge = 'on';
      DELETE FROM ...;
      COMMIT;
  Le réglage ne vaut que pour cette transaction. L'application ne l'utilise
  jamais.

  Non couvert : TRUNCATE et DROP TABLE (opérations d'administration).
*/

CREATE OR REPLACE FUNCTION "scoly_purge_autorisee"() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('scoly.autoriser_purge', true), '') = 'on'
$$;

-- Lignes en ajout seul : ni UPDATE ni DELETE.
CREATE OR REPLACE FUNCTION "scoly_archives_ligne_immuable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF "scoly_purge_autorisee"() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Opération % interdite sur "%" : les archives sont conservées et ne se modifient pas.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Documents : seule transition permise = ACTIF -> ANNULE, rien d'autre ne change.
CREATE OR REPLACE FUNCTION "scoly_documents_garde_modification"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF "scoly_purge_autorisee"() THEN
    RETURN NEW;
  END IF;

  IF OLD."statut" = 'ACTIF' AND NEW."statut" = 'ANNULE'
     AND (to_jsonb(NEW) - 'statut') = (to_jsonb(OLD) - 'statut') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Un document archivé ne peut pas être modifié (seule son annulation est permise).'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "documents_interdire_suppression"
  BEFORE DELETE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION "scoly_archives_ligne_immuable"();

CREATE TRIGGER "documents_garde_modification"
  BEFORE UPDATE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION "scoly_documents_garde_modification"();

CREATE TRIGGER "annulations_immuables"
  BEFORE UPDATE OR DELETE ON "annulations"
  FOR EACH ROW EXECUTE FUNCTION "scoly_archives_ligne_immuable"();

CREATE TRIGGER "telechargements_documents_immuables"
  BEFORE UPDATE OR DELETE ON "telechargements_documents"
  FOR EACH ROW EXECUTE FUNCTION "scoly_archives_ligne_immuable"();
