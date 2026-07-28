ALTER TABLE competitions ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#1559E8';
ALTER TABLE competitions ADD COLUMN pill_color TEXT NOT NULL DEFAULT '#2878FF';
ALTER TABLE competitions ADD COLUMN watermark_url TEXT;

UPDATE competitions
SET accent_color = CASE code
  WHEN 'LP' THEN '#001334'
  WHEN 'LE' THEN '#5F3601'
  WHEN 'TP' THEN '#005E32'
  WHEN 'TL' THEN '#022786'
  ELSE accent_color
END,
pill_color = CASE code
  WHEN 'LP' THEN '#022B6D'
  WHEN 'LE' THEN '#C27502'
  WHEN 'TP' THEN '#F44336'
  WHEN 'TL' THEN '#0233AF'
  ELSE pill_color
END,
watermark_url = CASE code
  WHEN 'LP' THEN 'https://upload.wikimedia.org/wikipedia/commons/5/5a/S%C3%ADmbolo_da_Liga_Portuguesa_de_Futebol_Profissional.png'
  WHEN 'LE' THEN 'https://img.uefa.com/imgml/uefacom/uel/2024/logos/uel_logotype_fc_dark.svg'
  WHEN 'TP' THEN 'https://r2.thesportsdb.com/images/media/league/badge/hyy7lq1593011553.png'
  WHEN 'TL' THEN 'https://www.ligaportugal.pt/backoffice/assets/ic_allianzcup_cbcb5ca1e0.png'
  ELSE watermark_url
END;
