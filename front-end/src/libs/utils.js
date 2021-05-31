function copy(input_data) {
	return JSON.parse(JSON.stringify(input_data));
}

function html_encode(value){
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace( /=/g, '&#61;' ).replace( / /g, '&#32;' );
}

function urlsafe_base64_encode(value) {
	return btoa(value).replace(/\=/g, '');
}

module.exports = {
    copy,
    html_encode,
    urlsafe_base64_encode
}