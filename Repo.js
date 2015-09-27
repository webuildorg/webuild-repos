function Repo(){
	this.url = '';
	this.name = '';
	this.description = '';
	this.updated_at;
	this.pushed_at;
	this.stars = 0;
	this.language = '';
	this.owner = {
		'uid': '',
		'avatar_url': '',
		'profile_url': ''
	}
}

Repo.prototype.is_valid = function(){

	return 	this.isValidURL(this.url) &&
					this.name &&
					this.description &&
					this.last_updated instanceof Date &&
					this.last_updated < new Date() &&
					!this.stars.isNaN() &&
					this.stars > 0 &&
					this.language &&
					this.owner.uid &&
					this.isValidURL(this.owner.avatar_url) &&
					this.isValidURL(this.owner.profile_url)
}

Repo.prototype.isValidURL = function(url){
	var urlRegex = /^(https?|ftp):\/\/[^\s\/$.?#].[^\s]*/;
 	return url && urlRegex.test(url);
}
